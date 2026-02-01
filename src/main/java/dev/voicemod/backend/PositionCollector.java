package dev.voicemod.backend;

import com.hypixel.hytale.server.core.modules.entity.component.TransformComponent;
import com.hypixel.hytale.server.core.universe.Universe;
import com.hypixel.hytale.server.core.universe.PlayerRef;

import javax.annotation.Nullable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Coleta posições dos jogadores de todos os mundos.
 * Usa PlayerRef.getReference().getStore() para acessar TransformComponent.
 */
public final class PositionCollector {

    private PositionCollector() {}

    /**
     * Coleta posições de todos os jogadores online.
     */
    public static List<Map<String, Object>> collectAll() {
        var out = new ArrayList<Map<String, Object>>();
        try {
            var universe = Universe.get();
            if (universe == null) return out;

            for (var playerRef : universe.getPlayers()) {
                try {
                    var data = collectOne(playerRef);
                    if (data != null) {
                        out.add(data);
                    }
                } catch (Throwable t) {
                    // ignorar jogador
                }
            }
        } catch (Throwable t) {
            // ignorar
        }
        return out;
    }

    @Nullable
    private static Map<String, Object> collectOne(PlayerRef playerRef) {
        try {
            var ref = playerRef.getReference();
            if (ref == null || !ref.isValid()) return null;

            var worldUuid = playerRef.getWorldUuid();
            if (worldUuid == null) return null;

            var store = ref.getStore();
            var transform = (TransformComponent) store.getComponent(ref, TransformComponent.getComponentType());
            if (transform == null) return null;

            var pos = transform.getPosition();
            if (pos == null) return null;

            return Map.of(
                "playerId", playerRef.getUuid().toString(),
                "username", playerRef.getUsername() != null ? playerRef.getUsername() : "?",
                "x", pos.getX(),
                "y", pos.getY(),
                "z", pos.getZ(),
                "worldId", worldUuid.toString()
            );
        } catch (Throwable t) {
            return null;
        }
    }
}
