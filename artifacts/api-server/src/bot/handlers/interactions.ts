import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  handleCreateTicketButton,
  handleCreateTicketModal,
  handleTicketClose,
  handleTicketClaim,
  handleTicketNotify,
  handleTicketPriority,
} from "./ticketHandler.js";
import {
  handleEmbedBuilderCommand,
  handleEmbedBuilderModal,
  handleEmbedAddButton,
  handleEmbedButtonModal,
  handleEmbedPublish,
  handleEmbedCancel,
  handleEmbedRoleButton,
} from "./embedHandler.js";
import config from "../../config.js";
import type { TicketPriority } from "../store.js";

// ─── Branding ────────────────────────────────────────────────────────────────
const BRAND   = 0x5865F2;
const SUCCESS = 0x57F287;
const DANGER  = 0xED4245;
const WARN    = 0xFEE75C;
const NEUTRAL = 0x2B2D31;

// ─── Main Router ─────────────────────────────────────────────────────────────
export async function handleInteraction(interaction: Interaction) {
  try {
    if (interaction.isChatInputCommand())  await handleCommand(interaction);
    else if (interaction.isButton())       await handleButton(interaction);
    else if (interaction.isModalSubmit())  await handleModal(interaction);
  } catch (err) {
    console.error("Interaction error:", err);
    try {
      const msg = "❌ Une erreur est survenue. Réessaie dans un instant.";
      if (!interaction.isRepliable()) return;
      if ("replied" in interaction && interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else if ("deferred" in interaction && interaction.deferred) {
        await interaction.editReply({ content: msg });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {}
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────
async function handleCommand(interaction: ChatInputCommandInteraction) {
  switch (interaction.commandName) {
    case "ticket-setup":  return handleTicketSetup(interaction);
    case "embed-builder": return handleEmbedBuilderCommand(interaction);
    case "lockdown":      return handleLockdown(interaction);
    case "avis":          return handleAvis(interaction);
    case "suggestion":    return handleSuggestion(interaction);
    case "candidature":   return handleCandidature(interaction);
  }
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
async function handleButton(interaction: ButtonInteraction) {
  const [prefix, ...rest] = interaction.customId.split(":");
  const value = rest.join(":");

  switch (prefix) {
    case "ticket_create":          return handleCreateTicketButton(interaction);
    case "ticket_close":           return handleTicketClose(interaction, value);
    case "ticket_claim":           return handleTicketClaim(interaction, value);
    case "ticket_notify":          return handleTicketNotify(interaction, value);
    case "ticket_priority_high":   return handleTicketPriority(interaction, value, "high");
    case "ticket_priority_medium": return handleTicketPriority(interaction, value, "medium");
    case "ticket_priority_low":    return handleTicketPriority(interaction, value, "low");
    case "embed_add_button":       return handleEmbedAddButton(interaction, value);
    case "embed_publish":          return handleEmbedPublish(interaction, value);
    case "embed_cancel":           return handleEmbedCancel(interaction, value);
    case "embed_role":             return handleEmbedRoleButton(interaction, value);
    case "application_accept":     return handleApplicationDecision(interaction, value, true);
    case "application_refuse":     return handleApplicationDecision(interaction, value, false);
  }
}

// ─── Modals ──────────────────────────────────────────────────────────────────
async function handleModal(interaction: ModalSubmitInteraction) {
  const [prefix, ...rest] = interaction.customId.split(":");
  const value = rest.join(":");

  switch (prefix) {
    case "modal_ticket_create":  return handleCreateTicketModal(interaction);
    case "modal_embed_builder":  return handleEmbedBuilderModal(interaction);
    case "modal_embed_button":   return handleEmbedButtonModal(interaction, value);
    case "modal_candidature":    return handleCandidatureSubmit(interaction);
  }
}

// ─── /ticket-setup ────────────────────────────────────────────────────────────
async function handleTicketSetup(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setTitle("🎫  Centre de Support")
    .setDescription(
      "### Besoin d'aide ? On est là ! ⚡\n" +
      "Clique sur le bouton ci-dessous pour ouvrir un ticket privé.\n" +
      "Notre équipe te répondra aussi vite que possible.",
    )
    .addFields(
      { name: "📋  Comment ça marche ?",
        value:
          "**1.** Clique sur **Créer un ticket**\n" +
          "**2.** Décris ton problème\n" +
          "**3.** Patiente, le staff arrive !",
        inline: true,
      },
      { name: "⚡  Priorités",
        value: "🔴 Urgente\n🟡 Normale\n🟢 Faible",
        inline: true,
      },
    )
    .setFooter({ text: "Un ticket par demande • Soyez précis pour une aide rapide" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel("Créer un ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary),
  );

  await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
  await interaction.editReply({ content: "✅ Panneau de tickets déployé avec succès !" });
}

// ─── /lockdown ────────────────────────────────────────────────────────────────
async function handleLockdown(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel as TextChannel;

  const perms = channel.permissionOverwrites.cache.get(interaction.guildId!);
  const isLocked = perms?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

  if (isLocked) {
    await channel.permissionOverwrites.edit(interaction.guildId!, { SendMessages: null });
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(SUCCESS)
          .setTitle("🔓  Salon Déverrouillé")
          .setDescription("Ce salon est à nouveau **ouvert** à tous les membres.")
          .setFooter({ text: `Déverrouillé par ${interaction.user.tag}` })
          .setTimestamp(),
      ],
    });
    await interaction.editReply({ content: "🔓 Salon déverrouillé." });
  } else {
    await channel.permissionOverwrites.edit(interaction.guildId!, { SendMessages: false });
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(DANGER)
          .setTitle("🔒  Salon Verrouillé")
          .setDescription("Ce salon a été **verrouillé** par le staff.\nPersonne ne peut écrire ici pour l'instant.")
          .setFooter({ text: `Verrouillé par ${interaction.user.tag}` })
          .setTimestamp(),
      ],
    });
    await interaction.editReply({ content: "🔒 Salon verrouillé." });
  }
}

// ─── /avis ───────────────────────────────────────────────────────────────────
async function handleAvis(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const note        = interaction.options.getInteger("note", true);
  const commentaire = interaction.options.getString("commentaire", true);

  const stars    = "⭐".repeat(note) + "✩".repeat(5 - note);
  const barColor = note >= 4 ? SUCCESS : note === 3 ? WARN : DANGER;

  const embed = new EmbedBuilder()
    .setColor(barColor)
    .setAuthor({
      name: interaction.user.tag,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTitle("⭐  Nouvel Avis Client")
    .addFields(
      { name: "Note",        value: `${stars}  **(${note} / 5)**`, inline: false },
      { name: "💬  Avis",   value: `> ${commentaire}`,            inline: false },
      { name: "✍️  Auteur", value: `<@${interaction.user.id}>`,   inline: true  },
    )
    .setTimestamp()
    .setFooter({ text: "Merci pour ton retour !" });

  let sent = false;
  if (config.reviewsChannelId) {
    const ch = interaction.guild?.channels.cache.get(config.reviewsChannelId) as TextChannel | undefined;
    if (ch) { await ch.send({ embeds: [embed] }); sent = true; }
  }
  if (!sent) await (interaction.channel as TextChannel).send({ embeds: [embed] });

  await interaction.editReply({ content: "✅ **Merci pour ton avis !** Il a bien été enregistré." });
}

// ─── /suggestion ──────────────────────────────────────────────────────────────
async function handleSuggestion(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const idee = interaction.options.getString("idee", true);

  const embed = new EmbedBuilder()
    .setColor(WARN)
    .setAuthor({
      name: `Suggestion de ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTitle("💡  Nouvelle Suggestion")
    .setDescription(`> ${idee}`)
    .addFields({ name: "Soumis par", value: `<@${interaction.user.id}>`, inline: true })
    .setFooter({ text: "Votez avec les réactions ci-dessous !" })
    .setTimestamp();

  let msg;
  if (config.suggestionsChannelId) {
    const ch = interaction.guild?.channels.cache.get(config.suggestionsChannelId) as TextChannel | undefined;
    if (ch) msg = await ch.send({ embeds: [embed] });
  }
  if (!msg) msg = await (interaction.channel as TextChannel).send({ embeds: [embed] });

  await msg.react("✅");
  await msg.react("❌");

  await interaction.editReply({ content: "✅ Ta suggestion a été soumise au vote de la communauté !" });
}

// ─── /candidature ─────────────────────────────────────────────────────────────
async function handleCandidature(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("modal_candidature")
    .setTitle("📋  Formulaire de Candidature");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("cand_age")
        .setLabel("Quel est ton âge ?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("cand_motivation")
        .setLabel("Pourquoi veux-tu rejoindre le staff ?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("cand_experience")
        .setLabel("As-tu déjà une expérience en modération ?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("cand_disponibilite")
        .setLabel("Disponibilité (heures / semaine)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("Ex : 10h par semaine"),
    ),
  );

  await interaction.showModal(modal);
}

async function handleCandidatureSubmit(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const age   = interaction.fields.getTextInputValue("cand_age");
  const motiv = interaction.fields.getTextInputValue("cand_motivation");
  const exp   = interaction.fields.getTextInputValue("cand_experience");
  const dispo = interaction.fields.getTextInputValue("cand_disponibilite");

  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setAuthor({
      name: `Candidature de ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTitle("📋  Nouvelle Candidature Staff")
    .addFields(
      { name: "🎂  Âge",            value: age,   inline: true },
      { name: "⏰  Disponibilité",  value: dispo, inline: true },
      { name: "💪  Motivations",    value: `> ${motiv}` },
      { name: "🛡️  Expériences",   value: `> ${exp}` },
    )
    .setFooter({ text: "Utilisez les boutons pour statuer sur cette candidature" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`application_accept:${interaction.user.id}`)
      .setLabel("Accepter")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`application_refuse:${interaction.user.id}`)
      .setLabel("Refuser")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),
  );

  let sent = false;
  if (config.applicationsChannelId) {
    const ch = interaction.guild?.channels.cache.get(config.applicationsChannelId) as TextChannel | undefined;
    if (ch) { await ch.send({ embeds: [embed], components: [row] }); sent = true; }
  }
  if (!sent) await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });

  await interaction.editReply({
    content: "✅ **Candidature envoyée !** Le staff va l'examiner et tu recevras une réponse.",
  });
}

// ─── Application Decision ─────────────────────────────────────────────────────
async function handleApplicationDecision(
  interaction: ButtonInteraction,
  userId: string,
  accepted: boolean,
) {
  await interaction.deferUpdate();

  const orig = interaction.message.embeds[0];
  const updated = new EmbedBuilder(orig.data)
    .setColor(accepted ? SUCCESS : DANGER)
    .addFields({
      name:  accepted ? "✅  Accepté par" : "❌  Refusé par",
      value: `<@${interaction.user.id}>`,
      inline: true,
    });

  await interaction.message.edit({ embeds: [updated], components: [] });

  try {
    const member = await interaction.guild?.members.fetch(userId);
    await member?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(accepted ? SUCCESS : DANGER)
          .setTitle(accepted ? "🎉  Candidature Acceptée !" : "😔  Candidature Refusée")
          .setDescription(
            accepted
              ? `Félicitations ! Ta candidature sur **${interaction.guild?.name}** a été **acceptée**.\nBienvenue dans l'équipe, on est ravis de t'avoir avec nous ! 🚀`
              : `Ta candidature sur **${interaction.guild?.name}** a malheureusement été **refusée** cette fois-ci.\nNe te décourage pas, et réessaie plus tard ! 💪`,
          )
          .setTimestamp(),
      ],
    });
  } catch {}
}
