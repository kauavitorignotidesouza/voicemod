/**
 * VoiceMod Web Client - Conecta ao backend e usa WebRTC para voz.
 */
(function () {
  const playerIdInput = document.getElementById('playerId');
  const usernameInput = document.getElementById('username');
  const btnConnect = document.getElementById('btnConnect');
  const btnDisconnect = document.getElementById('btnDisconnect');
  const btnPTT = document.getElementById('btnPTT');
  const pttStatusEl = document.getElementById('pttStatus');
  const statusEl = document.getElementById('status');
  const nearbyList = document.getElementById('nearbyList');
  const statusPanelToggle = document.getElementById('statusPanelToggle');
  const statusPanelContent = document.getElementById('statusPanelContent');
  const micStatusEl = document.getElementById('micStatus');
  const micLevelEl = document.getElementById('micLevel');
  const micMeterEl = document.getElementById('micMeter');
  const wsStatusEl = document.getElementById('wsStatus');
  const webrtcStatusEl = document.getElementById('webrtcStatus');
  const errorLogEl = document.getElementById('errorLog');
  const btnTestMic = document.getElementById('btnTestMic');

  let ws = null;
  let myPlayerId = null;
  let localStream = null;
  let audioContext = null;
  let analyserNode = null;
  let meterRAF = null;
  const peerConnections = new Map();
  const remoteAudios = new Map();
  let lastNearby = [];
  const errorLog = [];           // últimos erros
  const MAX_ERRORS = 10;
  let pttActive = false;

  const WS_URL = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;
  const PTT_KEY = 'v';

  function logError(msg) {
    const t = new Date().toLocaleTimeString();
    errorLog.push(`[${t}] ${msg}`);
    if (errorLog.length > MAX_ERRORS) errorLog.shift();
    errorLogEl.textContent = errorLog.length ? errorLog.join('\n') : 'Nenhum erro';
    errorLogEl.scrollTop = errorLogEl.scrollHeight;
  }

  function setMicStatus(text, ok = true) {
    micStatusEl.textContent = text;
    micStatusEl.className = ok ? 'ok' : 'err';
  }

  function updateStatusPanel() {
    if (ws) {
      wsStatusEl.textContent = ws.readyState === 1 ? 'Conectado' : ws.readyState === 0 ? 'Conectando...' : 'Desconectado';
      wsStatusEl.className = ws.readyState === 1 ? 'ok' : 'err';
    } else {
      wsStatusEl.textContent = 'Desconectado';
      wsStatusEl.className = '';
    }
    let connected = 0;
    peerConnections.forEach(pc => { if (pc.connectionState === 'connected') connected++; });
    webrtcStatusEl.textContent = connected + ' de ' + peerConnections.size + ' conexões';
    webrtcStatusEl.className = connected > 0 ? 'ok' : peerConnections.size > 0 ? 'warn' : '';
  }

  function startMeter() {
    if (!localStream || analyserNode) return;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioContext.createMediaStreamSource(localStream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.8;
      src.connect(analyserNode);
      const data = new Uint8Array(analyserNode.frequencyBinCount);

      function tick() {
        if (!analyserNode) return;
        analyserNode.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const pct = Math.min(100, Math.round(avg));
        micMeterEl.style.width = pct + '%';
        micMeterEl.classList.toggle('active', pct > 10);
        micLevelEl.textContent = pct + '%';
        meterRAF = requestAnimationFrame(tick);
      }
      tick();
    } catch (e) {
      micLevelEl.textContent = '—';
      logError('Meter: ' + e.message);
    }
  }

  function stopMeter() {
    if (meterRAF) cancelAnimationFrame(meterRAF);
    meterRAF = null;
    analyserNode = null;
    if (audioContext) audioContext.close().catch(() => {});
    audioContext = null;
    micMeterEl.style.width = '0%';
    micLevelEl.textContent = '—';
  }

  function setPTT(active) {
    if (pttActive === active) return;
    pttActive = active;
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = active; });
    }
    btnPTT.classList.toggle('talking', active);
    pttStatusEl.textContent = active ? 'Falando...' : '';
    if (active) pttStatusEl.className = 'ok';
    else pttStatusEl.className = '';
  }

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.className = isError ? 'error' : (ws && ws.readyState === 1 ? 'connected' : '');
    if (isError) logError(msg);
    updateStatusPanel();
  }

  function updateNearby(players) {
    lastNearby = players || [];
    nearbyList.innerHTML = '';
    if (!players || players.length === 0) {
      nearbyList.innerHTML = '<li style="color:#888">Nenhum jogador próximo</li>';
      return;
    }
    players.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(p.username || p.id)}</span><span class="volume">vol: ${(p.volume * 100).toFixed(0)}%</span>`;
      nearbyList.appendChild(li);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function initMicrophone() {
    if (localStream) {
      setMicStatus('Conectado');
      startMeter();
      return localStream;
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStatus('Conectado');
      startMeter();
      localStream.getAudioTracks().forEach(t => { t.enabled = false; }); // PTT: mudo por padrão
      return localStream;
    } catch (e) {
      setMicStatus('Erro: ' + e.message, false);
      logError('Microfone: ' + e.message);
      setStatus('Erro ao acessar microfone: ' + e.message, true);
      throw e;
    }
  }

  function createPeerConnection(remoteId, volume = 1) {
    if (peerConnections.has(remoteId)) return peerConnections.get(remoteId);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'turn:freeturn.net:3478', username: 'free', credential: 'free' },
      ]
    });

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream || stream.getAudioTracks().length === 0) return;
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = false;
      audio.volume = volume;
      audio.srcObject = stream;
      document.body.appendChild(audio);
      audio.play().catch(() => {});
      remoteAudios.set(remoteId, audio);
    };

    pc.onconnectionstatechange = () => {
      updateStatusPanel();
      if (pc.connectionState === 'connected') {
        console.log('WebRTC conectado com', remoteId);
      } else if (pc.connectionState === 'failed') {
        console.warn('WebRTC falhou com', remoteId);
        logError('WebRTC falhou com ' + remoteId);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'webrtc-ice', to: remoteId, candidate: e.candidate }));
      }
    };

    peerConnections.set(remoteId, pc);
    return pc;
  }

  async function handleOffer(fromId, sdp, volume) {
    try {
      const pc = createPeerConnection(fromId, volume);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'webrtc-answer', to: fromId, sdp: answer }));
      }
    } catch (e) {
      console.warn('Offer error:', e);
      logError('Offer: ' + e.message);
    }
  }

  async function handleAnswer(fromId, sdp) {
    const pc = peerConnections.get(fromId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.warn('Answer error:', e);
        logError('Answer: ' + e.message);
      }
    }
  }

  async function handleIce(fromId, candidate) {
    const pc = peerConnections.get(fromId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE candidate error:', e);
        logError('ICE: ' + e.message);
      }
    }
  }

  async function connectToNearby(nearby) {
    if (!nearby || nearby.length === 0 || !myPlayerId) return;
    if (!localStream) await initMicrophone();

    for (const p of nearby) {
      if (peerConnections.has(p.id)) {
        const audio = remoteAudios.get(p.id);
        if (audio) audio.volume = p.volume || 1;
        continue;
      }

      // Apenas o jogador com ID "menor" inicia a oferta (evita conexões duplicadas)
      if (myPlayerId.localeCompare(p.id) >= 0) continue;

      const pc = createPeerConnection(p.id, p.volume || 1);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'webrtc-offer', to: p.id, sdp: offer }));
      }
    }

    // Remove conexões de jogadores que saíram
    const ids = new Set(nearby.map(x => x.id));
    for (const [id, pc] of peerConnections) {
      if (!ids.has(id)) {
        pc.close();
        peerConnections.delete(id);
        remoteAudios.delete(id);
      }
    }
  }

  async function connect() {
    const playerId = playerIdInput.value.trim().toLowerCase();
    myPlayerId = playerId;
    if (!playerId) {
      setStatus('Digite seu UUID', true);
      return;
    }

    try {
      await initMicrophone();
    } catch {
      return;
    }

    setStatus('Conectando...');
    btnConnect.disabled = true;

    // Fecha conexão anterior se existir
    if (ws) {
      ws.close();
      ws = null;
    }

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        // setTimeout evita "Still in CONNECTING state" em alguns navegadores
        const socket = ws;
        setTimeout(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: 'join',
              playerId,
              username: usernameInput.value.trim() || 'Player',
              radius: 32
            }));
          }
        }, 0);
        setStatus('Conectado! Aguardando jogadores próximos...');
        btnConnect.style.display = 'none';
        btnDisconnect.style.display = 'block';
        btnPTT.disabled = false;
        updateStatusPanel();
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          switch (msg.type) {
            case 'joined':
              myPlayerId = playerId;
              const db = msg.debug || {};
              if (db.hasPosition) {
                setStatus('Conectado! Posição detectada. ' + (db.totalPlayers || 0) + ' jogador(es) no servidor.');
              } else {
                const hint = db.totalPlayers === 0
                  ? 'Plugin não está enviando. Verifique: jogo aberto, /voicemod --acao=status'
                  : 'Seu UUID pode não bater. Abra /status no navegador para ver os IDs recebidos.';
                setStatus('Posição não encontrada. ' + hint + ' (Total: ' + (db.totalPlayers || 0) + ')');
              }
              break;
            case 'nearby':
              updateNearby(msg.players);
              connectToNearby(msg.players);
              if (msg.players && msg.players.length > 0) {
                setStatus('Conectado. ' + msg.players.length + ' jogador(es) próximo(s) - voz ativa.');
              } else if (msg.debug && !msg.debug.hasPosition) {
                const url = location.origin + '/status';
                setStatus('Posição não detectada. Abra ' + url + ' para ver os IDs que o backend recebeu.');
              }
              break;
            case 'speaking':
              break;
            case 'webrtc-offer':
              handleOffer(msg.from, msg.sdp, msg.volume || 1);
              break;
            case 'webrtc-answer':
              handleAnswer(msg.from, msg.sdp);
              break;
            case 'webrtc-ice':
              handleIce(msg.from, msg.candidate).catch(() => {});
              break;
            case 'error':
              setStatus('Erro: ' + msg.message, true);
              break;
          }
        } catch (err) {
          console.error(err);
        }
      };

      ws.onclose = () => {
        myPlayerId = null;
        setPTT(false);
        btnPTT.disabled = true;
        setStatus('Desconectado');
        btnConnect.disabled = false;
        btnConnect.style.display = 'block';
        btnDisconnect.style.display = 'none';
        stopMeter();
        setMicStatus('—');
        peerConnections.forEach(pc => pc.close());
        peerConnections.clear();
        remoteAudios.clear();
        updateStatusPanel();
      };

      ws.onerror = () => {
        logError('WebSocket');
        setStatus('Erro de conexão', true);
      };

    } catch (e) {
      setStatus('Erro: ' + e.message, true);
      btnConnect.disabled = false;
    }
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  btnConnect.onclick = connect;
  btnDisconnect.onclick = disconnect;

  // Push-to-talk
  btnPTT.addEventListener('mousedown', (e) => { e.preventDefault(); setPTT(true); });
  btnPTT.addEventListener('mouseup', () => setPTT(false));
  btnPTT.addEventListener('mouseleave', () => setPTT(false));
  btnPTT.addEventListener('touchstart', (e) => { e.preventDefault(); setPTT(true); });
  btnPTT.addEventListener('touchend', () => setPTT(false));

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === PTT_KEY && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      setPTT(true);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === PTT_KEY && !e.repeat) setPTT(false);
  });

  statusPanelToggle.onclick = () => {
    const open = statusPanelContent.style.display !== 'none';
    statusPanelContent.style.display = open ? 'none' : 'block';
    statusPanelToggle.textContent = 'Status e diagnóstico ' + (open ? '▶' : '▼');
  };

  btnTestMic.onclick = async () => {
    if (localStream) {
      setMicStatus('Conectado (já em uso)');
      startMeter();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream = stream;
      setMicStatus('Conectado');
      startMeter();
      stream.getAudioTracks().forEach(t => { t.enabled = false; });
      errorLog.length = 0;
      errorLogEl.textContent = 'Microfone OK. Clique em Conectar para usar.';
    } catch (e) {
      setMicStatus('Erro: ' + e.message, false);
      logError('Microfone: ' + e.message);
    }
  };

  playerIdInput.onkeypress = (e) => { if (e.key === 'Enter') connect(); };
})();
