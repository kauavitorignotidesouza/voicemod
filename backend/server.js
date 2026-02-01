/**
 * VoiceMod Backend - Recebe posições do plugin Hytale e distribui via WebSocket.
 * Plugin envia POST /positions; clientes conectam via WebSocket e recebem nearby.
 * Serve o cliente web e faz signaling WebRTC.
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = parseInt(process.env.PORT || '25566', 10);

// Posições enviadas pelo plugin (playerId -> { x, y, z, worldId, username })
const serverPositions = new Map();

// Clientes conectados (playerId -> { ws, username })
const clients = new Map();

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ico': 'image/x-icon' };

// Servidor HTTP
const httpServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/positions') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.players && Array.isArray(data.players)) {
          serverPositions.clear();
          for (const p of data.players) {
            serverPositions.set(p.playerId, {
              x: p.x, y: p.y, z: p.z,
              worldId: p.worldId || 'default',
              username: p.username || 'Player',
            });
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: serverPositions.size }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // favicon.ico - evita 404 no console
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Servir cliente web
  let path = req.url === '/' ? '/index.html' : req.url;
  const filePath = join(__dirname, 'public', path);
  if (existsSync(filePath) && !filePath.includes('..')) {
    try {
      const data = readFileSync(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end();
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server: httpServer });

// Envia lista de jogadores próximos a um jogador
function sendNearbyPlayers(playerId, radius = 32) {
  const me = serverPositions.get(playerId) || clients.get(playerId)?.position;
  if (!me || me.x == null) return;

  const { x, y, z, worldId } = me;
  const nearby = [];

  for (const [id, p] of serverPositions) {
    if (id === playerId) continue;
    const pw = p.worldId || 'default';
    if (pw !== (worldId || 'default')) continue;

    const dx = p.x - x;
    const dy = p.y - y;
    const dz = p.z - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist <= radius) {
      const volume = Math.exp(-0.02 * dist);
      nearby.push({
        id,
        username: p.username,
        x: p.x, y: p.y, z: p.z,
        volume: Math.max(0, Math.min(1, volume)),
      });
    }
  }

  const client = clients.get(playerId);
  if (client?.ws.readyState === 1) {
    client.ws.send(JSON.stringify({ type: 'nearby', players: nearby }));
  }
}

wss.on('connection', (ws, req) => {
  let playerId = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      switch (msg.type) {
        case 'join':
          playerId = msg.playerId;
          const pos = serverPositions.get(playerId);
          clients.set(playerId, {
            ws,
            username: msg.username || pos?.username || 'Player',
            position: pos ? { x: pos.x, y: pos.y, z: pos.z, worldId: pos.worldId } : null,
          });
          ws.send(JSON.stringify({ type: 'joined', playerId }));
          sendNearbyPlayers(playerId, msg.radius || 32);
          break;

        case 'position':
          if (playerId && clients.has(playerId)) {
            const c = clients.get(playerId);
            if (msg.position) c.position = msg.position;
            if (msg.world) c.position = { ...c.position, worldId: msg.world };
          }
          break;

        case 'speaking':
          for (const [id, c] of clients) {
            if (id !== playerId && c.ws.readyState === 1) {
              c.ws.send(JSON.stringify({ type: 'speaking', playerId, speaking: msg.speaking }));
            }
          }
          break;

        case 'webrtc-offer':
        case 'webrtc-answer':
        case 'webrtc-ice':
          if (msg.to && clients.has(msg.to)) {
            const target = clients.get(msg.to);
            if (target.ws.readyState === 1) {
              const fwd = { ...msg, from: playerId };
              if (msg.type === 'webrtc-offer') {
                const nearby = serverPositions.get(playerId);
                const dist = nearby ? Math.sqrt(
                  Math.pow(nearby.x - (target.position?.x ?? 0), 2) +
                  Math.pow(nearby.y - (target.position?.y ?? 0), 2) +
                  Math.pow(nearby.z - (target.position?.z ?? 0), 2)
                ) : 32;
                fwd.volume = Math.max(0, Math.min(1, Math.exp(-0.02 * dist)));
              }
              target.ws.send(JSON.stringify(fwd));
            }
          }
          break;

        case 'pong':
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  });

  ws.on('close', () => {
    if (playerId) {
      clients.delete(playerId);
      for (const [id, c] of clients) {
        if (c.ws.readyState === 1) {
          c.ws.send(JSON.stringify({ type: 'left', playerId }));
        }
      }
    }
  });

  ws.on('error', () => {
    if (playerId) clients.delete(playerId);
  });
});

// Atualiza nearby a cada 100ms e mescla posições do servidor nos clientes
setInterval(() => {
  for (const [playerId, client] of clients) {
    const serverPos = serverPositions.get(playerId);
    if (serverPos && !client.position) {
      client.position = { x: serverPos.x, y: serverPos.y, z: serverPos.z, worldId: serverPos.worldId };
    } else if (serverPos) {
      client.position = { ...client.position, x: serverPos.x, y: serverPos.y, z: serverPos.z, worldId: serverPos.worldId };
    }
    sendNearbyPlayers(playerId, 32);
  }
}, 100);

httpServer.listen(PORT, () => {
  console.log(`VoiceMod Backend rodando na porta ${PORT}`);
  console.log('  Cliente web: https://voicemod.onrender.com');
  console.log('  POST /positions - Plugin envia posições');
  console.log('  WebSocket - Clientes de voz');
});
