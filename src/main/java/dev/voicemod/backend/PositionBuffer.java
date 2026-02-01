package dev.voicemod.backend;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Buffer thread-safe de posições dos jogadores.
 * Preenchido pelo VoiceProximitySystem (na thread do mundo) e lido pelo connector.
 */
public final class PositionBuffer {

    public static final PositionBuffer INSTANCE = new PositionBuffer();

    private final Map<String, PlayerPosition> positions = new ConcurrentHashMap<>();

    private PositionBuffer() {}

    /** Registra ou atualiza a posição de um jogador. Chamar da thread do mundo. */
    public void put(String playerId, String username, double x, double y, double z, String worldId) {
        positions.put(playerId, new PlayerPosition(playerId, username, x, y, z, worldId));
    }

    /** Remove jogador (ex: ao desconectar). */
    public void remove(String playerId) {
        positions.remove(playerId);
    }

    /** Retorna snapshot das posições para envio. Thread-safe. */
    public List<Map<String, Object>> snapshot() {
        var list = new ArrayList<Map<String, Object>>();
        for (var p : positions.values()) {
            list.add(Map.of(
                "playerId", p.playerId,
                "username", p.username,
                "x", p.x,
                "y", p.y,
                "z", p.z,
                "worldId", p.worldId
            ));
        }
        return list;
    }

    private static final class PlayerPosition {
        final String playerId, username, worldId;
        final double x, y, z;

        PlayerPosition(String playerId, String username, double x, double y, double z, String worldId) {
            this.playerId = playerId;
            this.username = username;
            this.x = x;
            this.y = y;
            this.z = z;
            this.worldId = worldId;
        }
    }
}
