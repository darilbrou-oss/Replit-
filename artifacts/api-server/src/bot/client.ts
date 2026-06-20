import { Client, GatewayIntentBits, Partials, ActivityType, Message } from "discord.js";
import { handleInteraction } from "./handlers/interactions.js";
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
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

  client.once("ready", async () => {
    console.log(`[Bot] Connecté en tant que ${client.user?.tag}`);
    await loadDb();
    client.user?.setActivity("🎫 Support | /ticket-setup", {
      type: ActivityType.Watching,
    });
  });

  client.on("interactionCreate", (interaction) => {
    handleInteraction(interaction).catch((err) =>
      console.error("[Bot] Erreur interaction:", err),
    );
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!config.aiChannelId) return;
    if (message.channelId !== config.aiChannelId) return;

    const now = Date.now();
    const last = cooldowns.get(message.author.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    cooldowns.set(message.author.id, now);

    const content = message.content.trim();
    if (!content) return;

    try {
      await message.channel.sendTyping();
      const reply = await askAI(message.author.id, content);
      await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
    } catch (err) {
      console.error("[Bot] Erreur IA:", err);
      await message.reply({ content: "❌ Je rencontre un problème, réessaie dans un instant.", allowedMentions: { repliedUser: false } });
    }
  });

  client.on("error", (err) => {
    console.error("[Bot] Erreur client:", err);
  });

  return client;
}
