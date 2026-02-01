/**
 * VoiceMod Web Client - Conecta ao backend e usa WebRTC para voz.
 */
(function () {
  const playerIdInput = document.getElementById('playerId');
  const usernameInput = document.getElementById('username');
  const btnConnect = document.getElementById('btnConnect');
  const btnDisconnect = document.getElementById('btnDisconnect');
  const statusEl = document.getElementById('status');
  const nearbyList = document.getElementById('nearbyList');

  let ws = null;
  let myPlayerId = null;
  let localStream = null;
  const peerConnections = new Map(); // playerId -> RTCPeerConnection
  const remoteAudios = new Map();    // playerId -> HTMLAudioElement
  let lastNearby = [];               // para volume no offer

  const WS_URL = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.className = isError ? 'error' : (ws && ws.readyState === 1 ? 'connected' : '');
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
    if (localStream) return localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return localStream;
    } catch (e) {
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
      if (pc.connectionState === 'connected') {
        console.log('WebRTC conectado com', remoteId);
      } else if (pc.connectionState === 'failed') {
        console.warn('WebRTC falhou com', remoteId);
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
    }
  }

  async function handleAnswer(fromId, sdp) {
    const pc = peerConnections.get(fromId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.warn('Answer error:', e);
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
        setStatus('Desconectado');
        btnConnect.disabled = false;
        btnConnect.style.display = 'block';
        btnDisconnect.style.display = 'none';
        peerConnections.forEach(pc => pc.close());
        peerConnections.clear();
        remoteAudios.clear();
      };

      ws.onerror = () => setStatus('Erro de conexão', true);

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

  // Permitir Enter no campo UUID
  playerIdInput.onkeypress = (e) => { if (e.key === 'Enter') connect(); };
})();
