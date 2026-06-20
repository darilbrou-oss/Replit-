import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";

export async function deployCommands(
  token: string,
  clientId: string,
  guildId?: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("[Deploy] Enregistrement des commandes globales...");

    // Always register globally so commands appear in every server the bot joins
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("[Deploy] ✅ Commandes globales enregistrées (visibles dans tous les serveurs)");

    // Also register on the configured guild for instant testing (no 1h delay)
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`[Deploy] ✅ Commandes aussi enregistrées sur le serveur de test ${guildId}`);
    }
  } catch (err) {
    console.error("[Deploy] Erreur lors de l'enregistrement des commandes:", err);
  }
}
