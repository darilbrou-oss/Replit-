import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";

export async function deployCommands(
  token: string,
  clientId: string,
  guildId?: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("[Deploy] Enregistrement des commandes slash...");

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`[Deploy] Commandes enregistrées pour le serveur ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log("[Deploy] Commandes globales enregistrées");
    }
  } catch (err) {
    console.error("[Deploy] Erreur lors de l'enregistrement des commandes:", err);
  }
}
