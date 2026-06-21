import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";

export async function deployCommands(
  token: string,
  clientId: string,
  guildId?: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    // 1. Clear guild-specific commands (removes duplicates)
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      console.log("[Deploy] ✅ Commandes du serveur supprimées (doublons effacés)");
    }

    // 2. Register globally — appear in every server, no duplicates
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("[Deploy] ✅ Commandes globales enregistrées");
  } catch (err) {
    console.error("[Deploy] Erreur:", err);
  }
}
