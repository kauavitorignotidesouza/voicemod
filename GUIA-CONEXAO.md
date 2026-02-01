# Guia passo a passo: Conectar Plugin ao Backend

## O que foi feito

1. **Plugin** envia posições dos jogadores para o backend via HTTP POST a cada 100ms
2. **Backend** recebe em `POST /positions` e usa essas posições para calcular quem está perto de quem
3. **Cliente de voz** conecta ao WebSocket e recebe a lista de jogadores próximos com volumes

---

## Passo 1: Iniciar o Backend

```bash
cd backend
npm install
npm start
```

Você deve ver:
```
VoiceMod Backend rodando na porta 25566
  POST /positions - Plugin envia posições
  WebSocket - Clientes de voz
```

---

## Passo 2: Configurar o Plugin

No arquivo `voicemod.properties` (criado na pasta do plugin ao iniciar), confira:

```properties
backend.url=http://localhost:25566
```

Se o backend estiver em outra máquina ou porta, altere conforme necessário.

---

## Passo 3: Iniciar o servidor Hytale

1. Coloque `voicemod-1.0.0.jar` na pasta `mods/` do servidor
2. Inicie o servidor Hytale
3. O plugin deve logar: `VoiceMod iniciado! Raio de voz: 32 blocos | Backend: http://localhost:25566`

---

## Passo 4: Testar a conexão

1. Entre no servidor com um jogador
2. O plugin começa a enviar posições automaticamente
3. O backend recebe e armazena em `serverPositions`
4. Quando um cliente de voz conectar com `join { playerId: "uuid-do-jogador" }`, receberá `nearby` com os jogadores próximos

---

## Fluxo de dados

```
[Hytale Server]                    [Backend Node.js]                 [Cliente de voz]
      |                                   |                                  |
      |  POST /positions (a cada 100ms)   |                                  |
      |  { players: [{playerId, x, y, z}] }|                                 |
      |---------------------------------->|                                  |
      |                                   |                                  |
      |                                   |   WebSocket: join { playerId }   |
      |                                   |<---------------------------------|
      |                                   |                                  |
      |                                   |   nearby { players: [...] }      |
      |                                   |--------------------------------->|
```

---

## Troubleshooting

- **Plugin não conecta**: Verifique se o backend está rodando antes do servidor
- **Posições vazias**: Entre no jogo com pelo menos um jogador
- **backend.url errado**: Edite `voicemod.properties` e use `/voicemod reload`
