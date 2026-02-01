package dev.voicemod.backend;

import dev.voicemod.config.VoiceModConfig;

import javax.annotation.Nonnull;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Envia posições dos jogadores ao backend via HTTP POST.
 */
public final class VoiceBackendConnector {

    private final VoiceModConfig config;
    private final HttpClient httpClient;
    private final ScheduledExecutorService scheduler;
    private volatile boolean running;

    public VoiceBackendConnector(@Nonnull VoiceModConfig config) {
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            var t = new Thread(r, "voicemod-backend-connector");
            t.setDaemon(true);
            return t;
        });
        this.running = false;
    }

    public void start() {
        if (running) return;
        running = true;
        scheduler.scheduleAtFixedRate(
            this::sendPositions,
            500,  // delay inicial 500ms
            100,  // a cada 100ms
            TimeUnit.MILLISECONDS
        );
    }

    public void stop() {
        running = false;
        scheduler.shutdown();
        try {
            scheduler.awaitTermination(2, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void sendPositions() {
        if (!running) return;
        try {
            var allPlayers = PositionCollector.collectAll();
            if (allPlayers.isEmpty()) return;

            var json = buildJson(allPlayers);
            var url = config.getBackendUrl().replaceAll("/$", "") + "/positions";
            var request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(3))
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();

            httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            // Silencioso - backend pode não estar rodando
        }
    }

    private String buildJson(List<Map<String, Object>> players) {
        var sb = new StringBuilder();
        sb.append("{\"players\":[");
        for (int i = 0; i < players.size(); i++) {
            if (i > 0) sb.append(",");
            var p = players.get(i);
            sb.append("{");
            sb.append("\"playerId\":\"").append(escape(p.get("playerId"))).append("\",");
            sb.append("\"username\":\"").append(escape(p.get("username"))).append("\",");
            sb.append("\"x\":").append(p.get("x")).append(",");
            sb.append("\"y\":").append(p.get("y")).append(",");
            sb.append("\"z\":").append(p.get("z")).append(",");
            sb.append("\"worldId\":\"").append(escape(p.get("worldId"))).append("\"");
            sb.append("}");
        }
        sb.append("]}");
        return sb.toString();
    }

    private static String escape(Object o) {
        if (o == null) return "";
        return o.toString()
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n");
    }
}
