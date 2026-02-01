package dev.voicemod;

import com.hypixel.hytale.server.core.plugin.JavaPlugin;
import com.hypixel.hytale.server.core.plugin.JavaPluginInit;
import dev.voicemod.backend.VoiceBackendConnector;
import dev.voicemod.command.VoiceModCommand;
import dev.voicemod.config.VoiceModConfig;
import dev.voicemod.event.VoiceModEvents;
import dev.voicemod.system.VoiceProximitySystem;
import dev.voicemod.system.VoiceStateSystem;
import dev.voicemod.voice.VoiceSessionManager;

import javax.annotation.Nonnull;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

/**
 * VoiceMod - Voice chat com proximidade e áudio 3D para Hytale.
 * Usa ECS para rastrear posições e aplicar lógica de proximidade.
 *
 * Referências: doc.hytaledev.fr, hytalemodding.dev, britakee GitBook
 */
public final class VoiceModPlugin extends JavaPlugin {

    private VoiceModConfig config;
    private VoiceModEvents events;
    private VoiceBackendConnector backendConnector;
    private ScheduledExecutorService scheduler;
    private ScheduledFuture<?> proximityClearTask;

    public VoiceModPlugin(@Nonnull JavaPluginInit init) {
        super(init);
    }

    @Override
    protected void setup() {
        config = new VoiceModConfig(getFile().getParent());
        config.load();
        events = new VoiceModEvents(this);
        // setup(): apenas preparar recursos. NÃO registrar commands/events/systems aqui.
    }

    @Override
    protected void start() {
        getEventRegistry().register(
            com.hypixel.hytale.server.core.event.events.player.PlayerConnectEvent.class,
            events::onPlayerConnect
        );
        getEventRegistry().register(
            com.hypixel.hytale.server.core.event.events.player.PlayerDisconnectEvent.class,
            events::onPlayerDisconnect
        );
        getEntityStoreRegistry().registerSystem(new VoiceStateSystem(config));
        getEntityStoreRegistry().registerSystem(new VoiceProximitySystem(config));
        getCommandRegistry().registerCommand(new VoiceModCommand(this));

        // Limpa listeners a cada 100ms para evitar dados obsoletos (jogador se afastou)
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            var t = new Thread(r, "voicemod-proximity-clear");
            t.setDaemon(true);
            return t;
        });
        proximityClearTask = scheduler.scheduleAtFixedRate(
            VoiceSessionManager.INSTANCE::clearAllListeners,
            100, 100, TimeUnit.MILLISECONDS
        );

        backendConnector = new VoiceBackendConnector(config);
        backendConnector.start();

        getLogger().at(Level.INFO).log("VoiceMod iniciado! Raio de voz: " + config.getVoiceRadius() + " blocos | Backend: " + config.getBackendUrl());
    }

    @Override
    protected void shutdown() {
        if (backendConnector != null) {
            backendConnector.stop();
        }
        if (proximityClearTask != null) {
            proximityClearTask.cancel(false);
        }
        if (scheduler != null) {
            scheduler.shutdown();
        }
        getLogger().at(Level.INFO).log("VoiceMod encerrado.");
    }

    public VoiceModConfig getConfig() {
        return config;
    }

    public VoiceBackendConnector getBackendConnector() {
        return backendConnector;
    }
}
