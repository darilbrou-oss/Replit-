import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  TextChannel,
  PermissionFlagsBits,
  ChannelType,
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

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error("Interaction error:", err);
    try {
      const errMsg = "❌ Une erreur est survenue. Réessaie plus tard.";
      if (interaction.isRepliable()) {
        if ("replied" in interaction && interaction.replied) {
          await interaction.followUp({ content: errMsg, ephemeral: true });
        } else if ("deferred" in interaction && interaction.deferred) {
          await interaction.editReply({ content: errMsg });
        } else {
          await interaction.reply({ content: errMsg, ephemeral: true });
        }
      }
    } catch {}
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case "ticket-setup":
      await handleTicketSetup(interaction);
      break;
    case "embed-builder":
      await handleEmbedBuilderCommand(interaction);
      break;
    case "lockdown":
      await handleLockdown(interaction);
      break;
    case "avis":
      await handleAvis(interaction);
      break;
    case "suggestion":
      await handleSuggestion(interaction);
      break;
    case "candidature":
      await handleCandidature(interaction);
      break;
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [prefix, ...rest] = interaction.customId.split(":");
  const value = rest.join(":");

  switch (prefix) {
    case "ticket_create":
      await handleCreateTicketButton(interaction);
      break;
    case "ticket_close":
      await handleTicketClose(interaction, value);
      break;
    case "ticket_claim":
      await handleTicketClaim(interaction, value);
      break;
    case "ticket_notify":
      await handleTicketNotify(interaction, value);
      break;
    case "ticket_priority_high":
      await handleTicketPriority(interaction, value, "high");
      break;
    case "ticket_priority_medium":
      await handleTicketPriority(interaction, value, "medium");
      break;
    case "ticket_priority_low":
      await handleTicketPriority(interaction, value, "low");
      break;
    case "embed_add_button":
      await handleEmbedAddButton(interaction, value);
      break;
    case "embed_publish":
      await handleEmbedPublish(interaction, value);
      break;
    case "embed_cancel":
      await handleEmbedCancel(interaction, value);
      break;
    case "embed_role":
      await handleEmbedRoleButton(interaction, value);
      break;
    case "application_accept":
      await handleApplicationDecision(interaction, value, true);
      break;
    case "application_refuse":
      await handleApplicationDecision(interaction, value, false);
      break;
  }
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [prefix, ...rest] = interaction.customId.split(":");
  const value = rest.join(":");

  switch (prefix) {
    case "modal_ticket_create":
      await handleCreateTicketModal(interaction);
      break;
    case "modal_embed_builder":
      await handleEmbedBuilderModal(interaction);
      break;
    case "modal_embed_button":
      await handleEmbedButtonModal(interaction, value);
      break;
    case "modal_candidature":
      await handleCandidatureSubmit(interaction);
      break;
  }
}

async function handleTicketSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle("🎫 Système de Support")
    .setDescription(
      "Besoin d'aide ou tu as une question ?\nClique sur le bouton ci-dessous pour créer un ticket.\n\nUn membre de notre équipe te répondra dès que possible. ⚡",
    )
    .setColor(Colors.Blurple)
    .addFields(
      { name: "⏱️ Temps de réponse", value: "Aussi vite que possible", inline: true },
      { name: "📋 Priorités", value: "🔴 Haute • 🟡 Moyenne • 🟢 Basse", inline: true },
    )
    .setFooter({ text: "Un ticket par problème svp" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel("Créer un ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary),
  );

  await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
  await interaction.editReply({ content: "✅ Panneau de tickets envoyé !" });
}

async function handleLockdown(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel as TextChannel;

  const everyonePerms = channel.permissionOverwrites.cache.get(
    interaction.guildId!,
  );
  const isLocked =
    everyonePerms?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

  if (isLocked) {
    await channel.permissionOverwrites.edit(interaction.guildId!, {
      SendMessages: null,
    });
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔓 Salon Déverrouillé")
          .setDescription("Ce salon est à nouveau ouvert à tous.")
          .setColor(Colors.Green)
          .setTimestamp(),
      ],
    });
    await interaction.editReply({ content: "🔓 Salon déverrouillé." });
  } else {
    await channel.permissionOverwrites.edit(interaction.guildId!, {
      SendMessages: false,
    });
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔒 Salon Verrouillé")
          .setDescription("Ce salon a été verrouillé par le staff.")
          .setColor(Colors.Red)
          .setTimestamp(),
      ],
    });
    await interaction.editReply({ content: "🔒 Salon verrouillé." });
  }
}

async function handleAvis(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const note = interaction.options.getInteger("note", true);
  const commentaire = interaction.options.getString("commentaire", true);

  const stars = "⭐".repeat(note) + "☆".repeat(5 - note);

  const embed = new EmbedBuilder()
    .setTitle("⭐ Nouvel Avis")
    .setColor(note >= 4 ? Colors.Yellow : note >= 3 ? Colors.Orange : Colors.Red)
    .addFields(
      { name: "Note", value: `${stars} (${note}/5)`, inline: true },
      { name: "Auteur", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Commentaire", value: commentaire },
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  const targetChannelId = config.reviewsChannelId;
  if (targetChannelId) {
    const ch = interaction.guild?.channels.cache.get(targetChannelId) as TextChannel | undefined;
    if (ch) {
      await ch.send({ embeds: [embed] });
      await interaction.editReply({ content: "✅ Ton avis a été envoyé, merci !" });
      return;
    }
  }

  await (interaction.channel as TextChannel).send({ embeds: [embed] });
  await interaction.editReply({ content: "✅ Avis envoyé !" });
}

async function handleSuggestion(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const idee = interaction.options.getString("idee", true);

  const embed = new EmbedBuilder()
    .setTitle("💡 Nouvelle Suggestion")
    .setDescription(idee)
    .setColor(Colors.Yellow)
    .addFields({ name: "Proposé par", value: `<@${interaction.user.id}>` })
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  const targetChannelId = config.suggestionsChannelId;
  let msg;
  if (targetChannelId) {
    const ch = interaction.guild?.channels.cache.get(targetChannelId) as TextChannel | undefined;
    if (ch) {
      msg = await ch.send({ embeds: [embed] });
    }
  }
  if (!msg) {
    msg = await (interaction.channel as TextChannel).send({ embeds: [embed] });
  }

  await msg.react("✅");
  await msg.react("❌");
  await interaction.editReply({ content: "✅ Suggestion envoyée ! La communauté peut voter." });
}

async function handleCandidature(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_candidature")
    .setTitle("📋 Formulaire de Candidature");

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
        .setLabel("As-tu déjà une expérience de modération ?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("cand_disponibilite")
        .setLabel("Quelle est ta disponibilité (heures/semaine) ?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function handleCandidatureSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const age = interaction.fields.getTextInputValue("cand_age");
  const motivation = interaction.fields.getTextInputValue("cand_motivation");
  const experience = interaction.fields.getTextInputValue("cand_experience");
  const dispo = interaction.fields.getTextInputValue("cand_disponibilite");

  const embed = new EmbedBuilder()
    .setTitle("📋 Nouvelle Candidature")
    .setColor(Colors.Blue)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "👤 Candidat", value: `<@${interaction.user.id}>`, inline: true },
      { name: "🎂 Âge", value: age, inline: true },
      { name: "💪 Motivations", value: motivation },
      { name: "🛡️ Expériences", value: experience },
      { name: "⏰ Disponibilité", value: dispo },
    )
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

  const targetChannelId = config.applicationsChannelId;
  if (targetChannelId) {
    const ch = interaction.guild?.channels.cache.get(targetChannelId) as TextChannel | undefined;
    if (ch) {
      await ch.send({ embeds: [embed], components: [row] });
      await interaction.editReply({ content: "✅ Ta candidature a été envoyée ! Le staff va l'examiner." });
      return;
    }
  }

  await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
  await interaction.editReply({ content: "✅ Candidature envoyée !" });
}

async function handleApplicationDecision(
  interaction: ButtonInteraction,
  userId: string,
  accepted: boolean,
): Promise<void> {
  await interaction.deferUpdate();

  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = new EmbedBuilder(originalEmbed.data)
    .setColor(accepted ? Colors.Green : Colors.Red)
    .addFields({
      name: accepted ? "✅ Accepté par" : "❌ Refusé par",
      value: `<@${interaction.user.id}>`,
      inline: true,
    });

  await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

  try {
    const member = await interaction.guild?.members.fetch(userId);
    if (member) {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(accepted ? "✅ Candidature Acceptée" : "❌ Candidature Refusée")
            .setDescription(
              accepted
                ? `Félicitations ! Ta candidature sur **${interaction.guild?.name}** a été **acceptée**. Bienvenue dans l'équipe ! 🎉`
                : `Ta candidature sur **${interaction.guild?.name}** a malheureusement été **refusée**. Ne te décourage pas !`,
            )
            .setColor(accepted ? Colors.Green : Colors.Red)
            .setTimestamp(),
        ],
      });
    }
  } catch {}
}

