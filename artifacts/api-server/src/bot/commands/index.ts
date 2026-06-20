import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("ticket-setup")
    .setDescription("🎫 Envoie le panneau de création de tickets dans ce salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("embed-builder")
    .setDescription("🛠️ Crée un embed personnalisé avec des boutons interactifs")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("🔒 Verrouille ou déverrouille ce salon en urgence")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("avis")
    .setDescription("⭐ Laisse un avis noté de 1 à 5 étoiles")
    .addIntegerOption((opt) =>
      opt
        .setName("note")
        .setDescription("Votre note de 1 à 5")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5),
    )
    .addStringOption((opt) =>
      opt
        .setName("commentaire")
        .setDescription("Votre commentaire")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("💡 Propose une idée ou une amélioration")
    .addStringOption((opt) =>
      opt
        .setName("idee")
        .setDescription("Décris ton idée")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("candidature")
    .setDescription("📋 Ouvre le formulaire de candidature"),
].map((cmd) => cmd.toJSON());
