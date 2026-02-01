# Revisão do Projeto VoiceMod

## Resumo

Revisão completa do VoiceMod com base em pesquisa sobre lógica de proximity voice chat e APIs Hytale.

---

## ✅ O que está correto

### 1. Estrutura do plugin
- Lifecycle: `setup()` → `start()` → `shutdown()`
- Registros em `start()` conforme doc.hytaledev.fr
- Manifest em PascalCase

### 2. Lógica de proximidade
- **Distância**: Euclidiana 3D (√(Δx²+Δy²+Δz²)) ✓
- **Filtro por mundo**: jogadores em mundos diferentes não se ouvem ✓
- **Raio configurável**: 4-128 blocos ✓

### 3. Atenuação de volume
- **Fórmula atual**: `volume = exp(-k * distance)`
- Padrão: k=0.02 → em 32 blocos ≈ 53% volume
- Dentro das práticas (decay exponencial é comum em jogos)

### 4. ECS e sistemas
- `VoiceStateSystem`: registra/sai jogadores via `onEntityAdded`/`onEntityRemove`
- `VoiceProximitySystem`: calcula quem ouve quem a cada tick
- Query correta: Player + PlayerRef + TransformComponent

### 5. Backend WebSocket
- Envia `nearby` com posições e volumes
- Mesma fórmula de atenuação
- Intervalo de 100ms para updates

---

## 🔧 Correções aplicadas

### Bug: clearListeners
- **Antes**: `clearListeners(listenerId)` limpava o ouvinte, mas os dados são por falante
- **Depois**: task periódica a cada 100ms chama `clearAllListeners()` para evitar dados obsoletos quando jogadores se afastam

---

## ⚠️ Gaps e limitações

### 1. Plugin e Backend desconectados
O plugin calcula proximidade no servidor, mas **não envia** esses dados ao backend WebSocket.

- **Backend atual**: recebe posições dos **clientes** (app web ou mod client-side)
- **Problema**: clientes precisam obter posição do jogo (requer mod client-side ou overlay)
- **Solução possível**: plugin abrir WebSocket client → conectar ao backend → enviar posições de todos os jogadores periodicamente

### 2. Hytale não expõe microfone
A API do Hytale não oferece captura de áudio do jogador. O voice real precisa de:
- **WebRTC** entre clientes (app web ou mod)
- Backend só faz **signaling** e distribui metadados (quem está perto, posições)

### 3. Áudio 3D no cliente
O áudio espacial (esquerda/direita) depende do cliente:
- Plugin/backend enviam: posição do falante, volume
- Cliente aplica: panning L/R conforme posição relativa

### 4. Dupla inscrição de jogadores
- `PlayerConnectEvent` chama `onPlayerJoin`
- `VoiceStateSystem.onEntityAdded` também chama `onPlayerJoin`
- Não é erro: `put` sobrescreve; mas pode ser redundante. Considerar usar só um dos dois.

---

## 📋 Próximos passos sugeridos

1. **Ponte Plugin → Backend**: WebSocket client no plugin para enviar posições
2. **Cliente de voz**: app web ou mod que conecta ao backend, captura microfone, aplica WebRTC e áudio 3D
3. **Config**: adicionar `voice.attenuation.mode` (exponential vs inverse_square) se quiser experimentar
4. **Testes**: validar build com Gradle e HytaleServer real

---

## Referências

- [Proximity Voice Chat - GetStream](https://getstream.io/glossary/proximity-voice-chat/)
- [Inverse Square Law - Stanford CCRMA](https://ccrma.stanford.edu/~jos/Delay/Inverse_Square_Law_Acoustics.html)
- [Hytale Playing Sounds - hytalemodding.dev](https://hytalemodding.dev/en/docs/guides/plugin/playing-sounds)
- [doc.hytaledev.fr](https://doc.hytaledev.fr/en/)
