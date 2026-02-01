package dev.voicemod.voice;

import javax.annotation.Nonnull;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Estado de voz de um jogador.
 */
public final class PlayerVoiceState {

    private final UUID playerId;
    private final String username;
    private volatile boolean speaking;
    private final Map<UUID, Double> listeners = new ConcurrentHashMap<>();

    public PlayerVoiceState(@Nonnull UUID playerId, @Nonnull String username) {
        this.playerId = playerId;
        this.username = username;
    }

    public UUID getPlayerId() {
        return playerId;
    }

    public String getUsername() {
        return username;
    }

    public boolean isSpeaking() {
        return speaking;
    }

    public void setSpeaking(boolean speaking) {
        this.speaking = speaking;
    }

    public void addListener(@Nonnull UUID listenerId, double volume) {
        listeners.put(listenerId, volume);
    }

    public void clearListeners() {
        listeners.clear();
    }

    public Map<UUID, Double> getListeners() {
        return Map.copyOf(listeners);
    }
}
