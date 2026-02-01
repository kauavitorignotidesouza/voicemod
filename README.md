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

- `/voicemod` ou `/voicemod --acao=help` - Ajuda
- `/voicemod --acao=status` - Status
- `/voicemod --acao=uuid` - Mostra seu UUID (para o cliente de voz)
- `/voicemod --acao=reload` - Recarrega config
- `/voicemod --acao=raio --blocos=32` - Define raio (4-128 blocos)

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

## Como usar o Voice Chat

1. **Plugin e Backend** – Servidor Hytale com plugin + backend no Render já configurados
2. **No jogo**, use `/voicemod --acao=uuid` para ver seu UUID
3. **Abra o cliente** em: https://voicemod.onrender.com
4. Cole seu UUID e clique em **Conectar**
5. Permita o acesso ao **microfone** quando o navegador pedir
6. Com outro jogador no mesmo mundo e perto (dentro do raio), ambos conectados ao cliente, a voz funcionará

**Limitação – jogadores em cidades diferentes:** WebRTC depende de TURN (servidores públicos gratuitos). Se falhar, use **Discord** em paralelo para voz. Mesma Wi‑Fi ou mesma cidade tende a funcionar.

## Backend (Node.js)

```bash
cd backend && npm install && npm start
```

- **GET /** – Cliente web de voz (página com formulário)
- **POST /positions** – Plugin envia posições dos jogadores
- **WebSocket** – Clientes enviam `join`; recebem `nearby` e fazem signaling WebRTC para voz
