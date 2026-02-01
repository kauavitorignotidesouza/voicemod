package dev.voicemod.command;

import com.hypixel.hytale.server.core.Message;
import com.hypixel.hytale.server.core.command.system.AbstractCommand;
import com.hypixel.hytale.server.core.command.system.CommandContext;
import com.hypixel.hytale.server.core.command.system.arguments.system.DefaultArg;
import com.hypixel.hytale.server.core.command.system.arguments.system.OptionalArg;
import com.hypixel.hytale.server.core.command.system.arguments.types.ArgTypes;
import dev.voicemod.VoiceModPlugin;
import dev.voicemod.config.VoiceModConfig;

import javax.annotation.Nonnull;
import java.util.concurrent.CompletableFuture;

/**
 * Comando /voicemod
 */
public final class VoiceModCommand extends AbstractCommand {

    private final VoiceModPlugin plugin;
    private final DefaultArg<String> subArg;
    private final OptionalArg<Integer> blocosArg;

    public VoiceModCommand(VoiceModPlugin plugin) {
        super("voicemod", "Configura o voice chat com proximidade e áudio 3D");
        this.plugin = plugin;
        this.subArg = withDefaultArg("acao", "help|raio|status|reload|uuid", ArgTypes.STRING, "help", "padrão: help");
        this.blocosArg = withOptionalArg("blocos", "Raio em blocos (4-128) para raio", ArgTypes.INTEGER);
        addAliases("vm");
    }

    @Override
    @Nonnull
    protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
        var sender = context.sender();
        if (!context.isPlayer()) {
            sender.sendMessage(Message.raw("Apenas jogadores podem usar este comando."));
            return CompletableFuture.completedFuture(null);
        }

        String sub = context.get(subArg);
        if (sub == null) sub = "help";

        return switch (sub.toLowerCase()) {
            case "raio", "radius" -> handleRadius(context, sender);
            case "status" -> handleStatus(context, sender);
            case "reload" -> handleReload(context, sender);
            case "uuid" -> handleUuid(context, sender);
            default -> handleHelp(context, sender);
        };
    }

    private CompletableFuture<Void> handleHelp(CommandContext context, com.hypixel.hytale.server.core.command.system.CommandSender sender) {
        var cfg = plugin.getConfig();
        sender.sendMessage(Message.raw("§aVoiceMod §7- Voice chat com proximidade"));
        sender.sendMessage(Message.raw("§e/voicemod raio [--blocos N] §7- Raio atual: " + cfg.getVoiceRadius()));
        sender.sendMessage(Message.raw("§e/voicemod status §7- Mostra status"));
        sender.sendMessage(Message.raw("§e/voicemod reload §7- Recarrega config"));
        sender.sendMessage(Message.raw("§e/voicemod uuid §7- Mostra seu UUID para o cliente de voz"));
        return CompletableFuture.completedFuture(null);
    }

    private CompletableFuture<Void> handleUuid(CommandContext context, com.hypixel.hytale.server.core.command.system.CommandSender sender) {
        var uuid = sender.getUuid();
        if (uuid != null) {
            sender.sendMessage(Message.raw("§aSeu UUID: §f" + uuid.toString()));
            sender.sendMessage(Message.raw("§7Use no cliente de voz: §fhttps://voicemod.onrender.com"));
        } else {
            sender.sendMessage(Message.raw("§cNão foi possível obter seu UUID."));
        }
        return CompletableFuture.completedFuture(null);
    }

    private CompletableFuture<Void> handleRadius(CommandContext context, com.hypixel.hytale.server.core.command.system.CommandSender sender) {
        Integer radius = context.get(blocosArg);
        if (radius == null) {
            sender.sendMessage(Message.raw("Uso: /voicemod raio --blocos <4-128>"));
            return CompletableFuture.completedFuture(null);
        }
        plugin.getConfig().setVoiceRadius(radius);
        plugin.getConfig().save();
        sender.sendMessage(Message.raw("§aRaio de voz definido para " + radius + " blocos."));
        return CompletableFuture.completedFuture(null);
    }

    private CompletableFuture<Void> handleStatus(CommandContext context, com.hypixel.hytale.server.core.command.system.CommandSender sender) {
        var cfg = plugin.getConfig();
        var conn = plugin.getBackendConnector();
        sender.sendMessage(Message.raw("§aVoiceMod Status"));
        sender.sendMessage(Message.raw("§7 Raio: §f" + cfg.getVoiceRadius() + " blocos §7| Áudio 3D: §f" + (cfg.isEnable3DAudio() ? "Ativado" : "Desativado")));
        sender.sendMessage(Message.raw("§7 Backend: §f" + cfg.getBackendUrl()));
        if (conn != null) {
            long last = conn.getLastSuccessMs();
            if (last > 0) {
                long secAgo = (System.currentTimeMillis() - last) / 1000;
                sender.sendMessage(Message.raw("§7 Último envio: §a" + secAgo + "s atrás §7(" + conn.getLastPlayersSent() + " jogadores)"));
            } else if (conn.getLastError() != null) {
                sender.sendMessage(Message.raw("§7 Conexão: §c" + conn.getLastError()));
            } else {
                sender.sendMessage(Message.raw("§7 Conexão: §eaguardando jogadores..."));
            }
        }
        return CompletableFuture.completedFuture(null);
    }

    private CompletableFuture<Void> handleReload(CommandContext context, com.hypixel.hytale.server.core.command.system.CommandSender sender) {
        plugin.getConfig().load();
        sender.sendMessage(Message.raw("§aConfig do VoiceMod recarregada."));
        return CompletableFuture.completedFuture(null);
    }
}
