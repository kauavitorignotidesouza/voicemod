package dev.voicemod.system;

import com.hypixel.hytale.component.CommandBuffer;
import com.hypixel.hytale.component.Ref;
import com.hypixel.hytale.component.Store;
import com.hypixel.hytale.component.query.Query;
import com.hypixel.hytale.component.system.RefChangeSystem;
import com.hypixel.hytale.server.core.entity.entities.Player;
import com.hypixel.hytale.server.core.universe.Universe;
import com.hypixel.hytale.server.core.universe.PlayerRef;
import com.hypixel.hytale.server.core.universe.world.storage.EntityStore;
import dev.voicemod.config.VoiceModConfig;
import dev.voicemod.voice.VoiceSessionManager;

import javax.annotation.Nonnull;
import javax.annotation.Nullable;

/**
 * RefChangeSystem que detecta quando Player é adicionado/removido de entidades.
 */
public final class VoiceStateSystem extends RefChangeSystem<EntityStore, Player> {

    private final VoiceModConfig config;

    public VoiceStateSystem(VoiceModConfig config) {
        this.config = config;
    }

    @Nonnull
    @Override
    public com.hypixel.hytale.component.ComponentType<EntityStore, Player> componentType() {
        return Player.getComponentType();
    }

    @Nullable
    @Override
    public Query<EntityStore> getQuery() {
        return Query.and(Player.getComponentType());
    }

    @Override
    public void onComponentAdded(
        @Nonnull Ref<EntityStore> ref,
        @Nonnull Player player,
        @Nonnull Store<EntityStore> store,
        @Nonnull CommandBuffer<EntityStore> commandBuffer
    ) {
        var universePlayerRef = findUniversePlayerRef(ref);
        if (universePlayerRef != null) {
            VoiceSessionManager.INSTANCE.onPlayerJoin(universePlayerRef);
        }
    }

    @Override
    public void onComponentSet(
        @Nonnull Ref<EntityStore> ref,
        @Nullable Player oldAttachment,
        @Nonnull Player newAttachment,
        @Nonnull Store<EntityStore> store,
        @Nonnull CommandBuffer<EntityStore> commandBuffer
    ) {
        // Player component updated - não precisamos fazer nada
    }

    @Override
    public void onComponentRemoved(
        @Nonnull Ref<EntityStore> ref,
        @Nonnull Player player,
        @Nonnull Store<EntityStore> store,
        @Nonnull CommandBuffer<EntityStore> commandBuffer
    ) {
        var universePlayerRef = findUniversePlayerRef(ref);
        if (universePlayerRef != null) {
            VoiceSessionManager.INSTANCE.onPlayerLeave(universePlayerRef);
        }
    }

    @Nullable
    private PlayerRef findUniversePlayerRef(Ref<EntityStore> ref) {
        for (var pr : Universe.get().getPlayers()) {
            var r = pr.getReference();
            if (r != null && r.equals(ref)) {
                return pr;
            }
        }
        return null;
    }
}
