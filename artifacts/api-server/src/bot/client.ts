import { Client, GatewayIntentBits, Partials, ActivityType } from "discord.js";
import { handleInteraction } from "./handlers/interactions.js";
import { loadDb } from "./store.js";

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

  client.on("error", (err) => {
    console.error("[Bot] Erreur client:", err);
  });

  return client;
}
