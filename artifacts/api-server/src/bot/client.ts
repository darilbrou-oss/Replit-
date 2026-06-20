import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  Message,
  GuildMember,
} from "discord.js";
import { handleInteraction } from "./handlers/interactions.js";
import { handleMessageSecurity, handleMemberJoin } from "./handlers/securityHandler.js";
import { loadDb } from "./store.js";
import { askAI } from "./ai.js";
import config from "../config.js";

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 2000;

export function createBotClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

  // ── Ready ──────────────────────────────────────────────────────────────────
  client.once("ready", async () => {
    console.log(`[Bot] ✅ Connecté en tant que ${client.user?.tag}`);
    await loadDb();
    client.user?.setActivity("🛡️ Protection | /ticket-setup", {
      type: ActivityType.Watching,
    });
  });

  // ── Interactions (slash, buttons, modals) ──────────────────────────────────
  client.on("interactionCreate", (interaction) => {
    handleInteraction(interaction).catch((err) =>
      console.error("[Bot] Erreur interaction:", err),
    );
  });

  // ── Messages ───────────────────────────────────────────────────────────────
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot || !message.guild) return;

    // Security checks (anti-spam, anti-links) — runs in every channel
    await handleMessageSecurity(message).catch((err) =>
      console.error("[Bot] Erreur sécurité message:", err),
    );

    // AI chat — runs only in the configured AI channel
    if (config.aiChannelId && message.channelId === config.aiChannelId) {
      const now  = Date.now();
      const last = cooldowns.get(message.author.id) ?? 0;
      if (now - last < COOLDOWN_MS) return;
      cooldowns.set(message.author.id, now);

      const content = message.content.trim();
      if (!content) return;

      try {
        await message.channel.sendTyping();
        const reply = await askAI(message.author.id, content);
        await message.reply({
          content: reply,
          allowedMentions: { repliedUser: false },
        });
      } catch (err) {
        console.error("[Bot] Erreur IA:", err);
        await message.reply({
          content: "❌ Je rencontre un problème, réessaie dans un instant.",
          allowedMentions: { repliedUser: false },
        });
      }
    }
  });

  // ── Member Join (welcome, anti-raid, anti-fake, auto-role) ─────────────────
  client.on("guildMemberAdd", async (member: GuildMember) => {
    await handleMemberJoin(member).catch((err) =>
      console.error("[Bot] Erreur guildMemberAdd:", err),
    );
  });

  // ── Errors ─────────────────────────────────────────────────────────────────
  client.on("error", (err) => {
    console.error("[Bot] Erreur client Discord:", err);
  });

  return client;
}
