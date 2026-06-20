import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

export const commands = [
  // ── Support ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("ticket-setup")
    .setDescription("🎫 Déploie le panneau de création de tickets dans ce salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("embed-builder")
    .setDescription("🛠️ Crée un embed personnalisé avec des boutons interactifs")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ── Sécurité ─────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("🔒 Verrouille ou déverrouille tous les salons du serveur en urgence")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("⚠️ Avertit un membre (3 warns = mute 10 min automatique)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((o) =>
      o.setName("membre").setDescription("Le membre à avertir").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("raison").setDescription("Raison de l'avertissement").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("📋 Consulte les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((o) =>
      o.setName("membre").setDescription("Le membre à consulter").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("clear-warns")
    .setDescription("🗑️ Efface tous les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((o) =>
      o.setName("membre").setDescription("Le membre").setRequired(true),
    ),

  // ── Communauté ───────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("avis")
    .setDescription("⭐ Laisse un avis noté de 1 à 5 étoiles")
    .addIntegerOption((o) =>
      o.setName("note").setDescription("Ta note de 1 à 5").setRequired(true).setMinValue(1).setMaxValue(5),
    )
    .addStringOption((o) =>
      o.setName("commentaire").setDescription("Ton commentaire").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("💡 Propose une idée ou une amélioration")
    .addStringOption((o) =>
      o.setName("idee").setDescription("Décris ton idée").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("candidature")
    .setDescription("📋 Remplis le formulaire de candidature staff"),
].map((cmd) => cmd.toJSON());
