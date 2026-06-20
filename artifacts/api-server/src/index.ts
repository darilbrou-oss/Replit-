import app from "./app.js";
import { logger } from "./lib/logger.js";
import { createBotClient } from "./bot/client.js";
import { deployCommands } from "./bot/deploy.js";

const port = Number(process.env["PORT"] ?? 8080);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

const token    = process.env["DISCORD_TOKEN"];
const clientId = process.env["DISCORD_CLIENT_ID"];
const guildId  = process.env["DISCORD_GUILD_ID"];

if (token && clientId) {
  deployCommands(token, clientId, guildId || undefined).catch((err) =>
    logger.error({ err }, "Failed to deploy commands"),
  );

  const bot = createBotClient();
  bot.login(token).catch((err) => {
    logger.error({ err }, "[Bot] Échec de connexion Discord");
    process.exit(1);
  });
} else {
  logger.warn("[Bot] DISCORD_TOKEN ou DISCORD_CLIENT_ID manquant — bot non démarré");
}
