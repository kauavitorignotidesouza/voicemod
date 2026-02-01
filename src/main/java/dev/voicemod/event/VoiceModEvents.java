package dev.voicemod.event;

import com.hypixel.hytale.server.core.event.events.player.PlayerConnectEvent;
import com.hypixel.hytale.server.core.event.events.player.PlayerDisconnectEvent;
import dev.voicemod.VoiceModPlugin;
import dev.voicemod.backend.PositionBuffer;
import dev.voicemod.voice.VoiceSessionManager;

import javax.annotation.Nonnull;

/**
 * Handlers de eventos do EventBus para VoiceMod.
 * Package correto: com.hypixel.hytale.server.core.event.events.player
 */
public final class VoiceModEvents {

    private final VoiceModPlugin plugin;

    public VoiceModEvents(VoiceModPlugin plugin) {
        this.plugin = plugin;
    }

    public void onPlayerConnect(@Nonnull PlayerConnectEvent event) {
        var playerRef = event.getPlayerRef();
        if (playerRef != null) {
            VoiceSessionManager.INSTANCE.onPlayerJoin(playerRef);
        }
    }

    public void onPlayerDisconnect(@Nonnull PlayerDisconnectEvent event) {
        var playerRef = event.getPlayerRef();
        if (playerRef != null) {
            PositionBuffer.INSTANCE.remove(playerRef.getUuid().toString());
            VoiceSessionManager.INSTANCE.onPlayerLeave(playerRef);
        }
    }
}
