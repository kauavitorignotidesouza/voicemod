package dev.voicemod.system;

import com.hypixel.hytale.component.ArchetypeChunk;
import com.hypixel.hytale.component.CommandBuffer;
import com.hypixel.hytale.component.Store;
import com.hypixel.hytale.component.query.Query;
import com.hypixel.hytale.component.system.tick.EntityTickingSystem;
import com.hypixel.hytale.server.core.entity.entities.Player;
import com.hypixel.hytale.server.core.modules.entity.component.TransformComponent;
import com.hypixel.hytale.server.core.universe.Universe;
import com.hypixel.hytale.server.core.universe.PlayerRef;
import com.hypixel.hytale.server.core.universe.world.storage.EntityStore;
import dev.voicemod.backend.PositionBuffer;
import dev.voicemod.config.VoiceModConfig;
import dev.voicemod.voice.VoiceSessionManager;

import javax.annotation.Nonnull;

/**
 * EntityTickingSystem que calcula proximidade entre jogadores.
 */
public final class VoiceProximitySystem extends EntityTickingSystem<EntityStore> {

    private final VoiceModConfig config;

    public VoiceProximitySystem(VoiceModConfig config) {
        this.config = config;
    }

    @Nonnull
    @Override
    public Query<EntityStore> getQuery() {
        return Query.and(
            Player.getComponentType(),
            TransformComponent.getComponentType()
        );
    }

    @Override
    public void tick(
        float dt,
        int index,
        @Nonnull ArchetypeChunk<EntityStore> chunk,
        @Nonnull Store<EntityStore> store,
        @Nonnull CommandBuffer<EntityStore> buffer
    ) {
        var listenerRef = chunk.getReferenceTo(index);
        var listenerTransform = (TransformComponent) chunk.getComponent(index, TransformComponent.getComponentType());

        var listenerPos = listenerTransform.getPosition();
        if (listenerPos == null) return;

        var universePlayerRef = findUniversePlayerRef(listenerRef);
        if (universePlayerRef == null) return;

        var listenerId = universePlayerRef.getUuid();
        var worldUuid = universePlayerRef.getWorldUuid();
        if (worldUuid == null) return;

        // Armazena posição do listener para o backend (thread do mundo = seguro)
        PositionBuffer.INSTANCE.put(
            listenerId.toString(),
            universePlayerRef.getUsername() != null ? universePlayerRef.getUsername() : "?",
            listenerPos.getX(), listenerPos.getY(), listenerPos.getZ(),
            worldUuid.toString()
        );

        for (var playerRef : Universe.get().getPlayers()) {
            if (playerRef.getUuid().equals(listenerId)) continue;
            if (playerRef.getWorldUuid() == null || !playerRef.getWorldUuid().equals(worldUuid)) continue;

            var speakerRef = playerRef.getReference();
            if (speakerRef == null || !speakerRef.isValid()) continue;

            var speakerTransform = (TransformComponent) store.getComponent(speakerRef, TransformComponent.getComponentType());
            if (speakerTransform == null) continue;

            var speakerPos = speakerTransform.getPosition();
            if (speakerPos == null) continue;

            // Armazena posição do speaker para o backend
            PositionBuffer.INSTANCE.put(
                playerRef.getUuid().toString(),
                playerRef.getUsername() != null ? playerRef.getUsername() : "?",
                speakerPos.getX(), speakerPos.getY(), speakerPos.getZ(),
                worldUuid.toString()
            );

            var distance = listenerPos.distanceTo(speakerPos);
            if (distance <= config.getVoiceRadius()) {
                var volume = computeVolume(distance);
                VoiceSessionManager.INSTANCE.addListener(playerRef.getUuid(), listenerId, volume);
            }
        }
    }

    private PlayerRef findUniversePlayerRef(com.hypixel.hytale.component.Ref<EntityStore> ref) {
        for (var pr : Universe.get().getPlayers()) {
            var r = pr.getReference();
            if (r != null && r.equals(ref)) {
                return pr;
            }
        }
        return null;
    }

    private double computeVolume(double distance) {
        if (distance <= 0) return 1.0;
        var volume = Math.exp(-config.getAttenuationFactor() * distance);
        return Math.max(0, Math.min(1, volume));
    }
}
