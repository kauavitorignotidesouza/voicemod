package dev.voicemod.config;


import javax.annotation.Nonnull;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * Configuração do VoiceMod.
 */
public final class VoiceModConfig {

    private static final String CONFIG_FILE = "voicemod.properties";

    private final Path configPath;
    private int voiceRadius = 32;
    private double attenuationFactor = 0.02;
    private boolean enable3DAudio = true;
    private int websocketPort = 25566;
    private String backendUrl = "http://localhost:25566";

    public VoiceModConfig(@Nonnull Path pluginDir) {
        this.configPath = pluginDir.resolve(CONFIG_FILE);
    }

    public void load() {
        if (!Files.exists(configPath)) {
            save();
            return;
        }
        try (var reader = Files.newBufferedReader(configPath)) {
            var props = new Properties();
            props.load(reader);
            voiceRadius = Integer.parseInt(props.getProperty("voice.radius", "32"));
            attenuationFactor = Double.parseDouble(props.getProperty("voice.attenuation", "0.02"));
            enable3DAudio = Boolean.parseBoolean(props.getProperty("voice.3d.enabled", "true"));
            websocketPort = Integer.parseInt(props.getProperty("websocket.port", "25566"));
            backendUrl = props.getProperty("backend.url", "http://localhost:25566");
        } catch (Exception e) {
            // Usando defaults em caso de erro
        }
    }

    public void save() {
        try {
            Files.createDirectories(configPath.getParent());
            try (var writer = Files.newBufferedWriter(configPath)) {
                var props = new Properties();
                props.setProperty("voice.radius", String.valueOf(voiceRadius));
                props.setProperty("voice.attenuation", String.valueOf(attenuationFactor));
                props.setProperty("voice.3d.enabled", String.valueOf(enable3DAudio));
                props.setProperty("websocket.port", String.valueOf(websocketPort));
                props.setProperty("backend.url", backendUrl);
                props.store(writer, "VoiceMod Configuration");
            }
        } catch (Exception e) {
            // Ignorar erro de escrita
        }
    }

    public int getVoiceRadius() {
        return voiceRadius;
    }

    public double getAttenuationFactor() {
        return attenuationFactor;
    }

    public boolean isEnable3DAudio() {
        return enable3DAudio;
    }

    public int getWebsocketPort() {
        return websocketPort;
    }

    public String getBackendUrl() {
        return backendUrl;
    }

    public void setVoiceRadius(int voiceRadius) {
        this.voiceRadius = Math.max(4, Math.min(128, voiceRadius));
    }

    public void setAttenuationFactor(double attenuationFactor) {
        this.attenuationFactor = Math.max(0.001, Math.min(0.1, attenuationFactor));
    }
}
