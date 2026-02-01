package dev.voicemod.voice;

import com.hypixel.hytale.server.core.universe.PlayerRef;

import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Gerencia sessões de voz por jogador.
 * Mantém estado de quem está falando e quem está ouvindo quem.
 */
public final class VoiceSessionManager {

    public static final VoiceSessionManager INSTANCE = new VoiceSessionManager();

    private final Map<UUID, PlayerVoiceState> playerStates = new ConcurrentHashMap<>();

    private VoiceSessionManager() {
    }

    public void onPlayerJoin(@Nonnull PlayerRef playerRef) {
        playerStates.put(playerRef.getUuid(), new PlayerVoiceState(playerRef.getUuid(), playerRef.getUsername()));
    }

    public void onPlayerLeave(@Nonnull PlayerRef playerRef) {
        playerStates.remove(playerRef.getUuid());
    }

    public void setSpeaking(@Nonnull UUID playerId, boolean speaking) {
        var state = playerStates.get(playerId);
        if (state != null) {
            state.setSpeaking(speaking);
        }
    }

    public void addListener(@Nonnull UUID speakerId, @Nonnull UUID listenerId, double volume) {
        var state = playerStates.get(speakerId);
        if (state != null) {
            state.addListener(listenerId, volume);
        }
    }

    public void clearListeners(@Nonnull UUID speakerId) {
        var state = playerStates.get(speakerId);
        if (state != null) {
            state.clearListeners();
        }
    }

    /** Limpa todos os listeners de todos os jogadores. Chamar no início de cada tick. */
    public void clearAllListeners() {
        for (var state : playerStates.values()) {
            state.clearListeners();
        }
    }

    @Nullable
    public PlayerVoiceState getState(@Nonnull UUID playerId) {
        return playerStates.get(playerId);
    }

    public Map<UUID, PlayerVoiceState> getAllStates() {
        return Map.copyOf(playerStates);
    }
}
