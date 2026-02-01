# VoiceMod - Voice Chat com Proximidade e Áudio 3D para Hytale

Mod de voice chat para Hytale com proximidade e áudio 3D, baseado nas APIs oficiais.

## Documentação de Referência

- [doc.hytaledev.fr](https://doc.hytaledev.fr/en/) - API principal
- [hytalemodding.dev](https://hytalemodding.dev/pt-BR/docs) - Guias PT-BR
- [Britakee GitBook](https://britakee-studios.gitbook.io/hytale-modding-documentation) - Overview

## Arquitetura

1. **Plugin Hytale** → envia posições via POST a cada 100ms
2. **Backend Node.js** → recebe posições e distribui via WebSocket
3. **Cliente de voz** → conecta ao WebSocket, recebe jogadores próximos (nearby) e volumes

Ver `REVISAO_PROJETO.md` para análise completa.

## Comandos

- `/voicemod` ou `/voicemod help` - Ajuda
- `/voicemod status` - Status
- `/voicemod reload` - Recarrega config
- `/voicemod raio --blocos 32` - Define raio (4-128 blocos)

## Build

1. Coloque `HytaleServer.jar` em `libs/` (veja `libs/LEIA-ME.txt`)
2. Execute: `./gradlew jar` ou no IntelliJ: Gradle → voicemod → Tasks → build → jar

JAR em `build/libs/voicemod-1.0.0.jar` → coloque em `mods/` do servidor.

## Config

`voicemod.properties` na pasta do plugin:

```properties
voice.radius=32
voice.attenuation=0.02
voice.3d.enabled=true
websocket.port=25566
backend.url=http://localhost:25566
```

## Como conectar Plugin + Backend

1. **Inicie o backend primeiro**: `cd backend && npm install && npm start`
2. **Inicie o servidor Hytale** com o plugin na pasta `mods/`
3. O plugin envia posições automaticamente para `backend.url` a cada 100ms
4. Clientes conectam via WebSocket em `ws://localhost:25566`, enviam `join` com `playerId` (UUID do jogador)

## Backend (Node.js)

```bash
cd backend && npm install && npm start
```

- **POST /positions** – Plugin envia posições dos jogadores
- **WebSocket** – Clientes enviam `join`, `speaking`; recebem `nearby` com jogadores próximos e volumes
