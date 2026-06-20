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
  MessageFlags,
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
import {
  addWarn,
  getWarns,
  clearWarns,
  activateLockdown,
  getLockdownState,
} from "./securityHandler.js";
import config from "../../config.js";

// ─── Colors ───────────────────────────────────────────────────────────────────
const BRAND   = 0x5865F2;
const SUCCESS = 0x57F287;
const DANGER  = 0xED4245;
const WARN    = 0xFEE75C;

// ─── Helper: get TextChannel safely ──────────────────────────────────────────
async function getTextChannel(
  i: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
): Promise<TextChannel | null> {
  if (!i.guild) return null;
  try {
    const ch = await i.guild.channels.fetch(i.channelId);
    return ch instanceof TextChannel ? ch : null;
  } catch {
    return null;
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────
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
      if ("replied" in interaction && interaction.replied)        await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
      else if ("deferred" in interaction && interaction.deferred) await interaction.editReply({ content: msg });
      else                                                         await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    } catch {}
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────
async function handleCommand(i: ChatInputCommandInteraction) {
  switch (i.commandName) {
    case "ticket-setup":  return handleTicketSetup(i);
    case "embed-builder": return handleEmbedBuilderCommand(i);
    case "lockdown":      return handleLockdownCmd(i);
    case "warn":          return handleWarnCmd(i);
    case "warnings":      return handleWarningsCmd(i);
    case "clear-warns":   return handleClearWarnsCmd(i);
    case "avis":          return handleAvis(i);
    case "suggestion":    return handleSuggestion(i);
    case "candidature":   return handleCandidature(i);
  }
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
async function handleButton(i: ButtonInteraction) {
  const [prefix, ...rest] = i.customId.split(":");
  const value = rest.join(":");

  switch (prefix) {
    case "ticket_create":          return handleCreateTicketButton(i);
    case "ticket_close":           return handleTicketClose(i, value);
    case "ticket_claim":           return handleTicketClaim(i, value);
    case "ticket_notify":          return handleTicketNotify(i, value);
    case "ticket_priority_high":   return handleTicketPriority(i, value, "high");
    case "ticket_priority_medium": return handleTicketPriority(i, value, "medium");
    case "ticket_priority_low":    return handleTicketPriority(i, value, "low");
    case "embed_add_button":       return handleEmbedAddButton(i, value);
    case "embed_publish":          return handleEmbedPublish(i, value);
    case "embed_cancel":           return handleEmbedCancel(i, value);
    case "embed_role":             return handleEmbedRoleButton(i, value);
    case "application_accept":     return handleApplicationDecision(i, value, true);
    case "application_refuse":     return handleApplicationDecision(i, value, false);
  }
}

// ─── Modals ──────────────────────────────────────────────────────────────────
async function handleModal(i: ModalSubmitInteraction) {
  const [prefix, ...rest] = i.customId.split(":");
  const value = rest.join(":");

  switch (prefix) {
    case "modal_ticket_create":  return handleCreateTicketModal(i);
    case "modal_embed_builder":  return handleEmbedBuilderModal(i);
    case "modal_embed_button":   return handleEmbedButtonModal(i, value);
    case "modal_candidature":    return handleCandidatureSubmit(i);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── /ticket-setup ────────────────────────────────────────────────────────────
async function handleTicketSetup(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const ch = await getTextChannel(i);
  if (!ch) {
    await i.editReply({ content: "❌ Impossible d'accéder à ce salon." });
    return;
  }

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
        value: "**1.** Clique sur **Créer un ticket**\n**2.** Décris ton problème\n**3.** Patiente, le staff arrive !",
        inline: true },
      { name: "⚡  Priorités", value: "🔴 Urgente\n🟡 Normale\n🟢 Faible", inline: true },
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

  await ch.send({ embeds: [embed], components: [row] });
  await i.editReply({ content: "✅ Panneau de tickets déployé avec succès !" });
}

// ─── /lockdown ────────────────────────────────────────────────────────────────
async function handleLockdownCmd(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (!i.guild) return;

  const locked = getLockdownState(i.guild.id);
  await activateLockdown(i.guild, !locked);

  const embed = new EmbedBuilder()
    .setColor(locked ? SUCCESS : DANGER)
    .setTitle(locked ? "🔓  Lockdown Levé" : "🔒  Lockdown Activé")
    .setDescription(
      locked
        ? "Le serveur est à nouveau **ouvert**. Tout le monde peut écrire."
        : "Le serveur est **verrouillé**. Plus personne ne peut écrire dans les salons.\nRelance `/lockdown` pour le déverrouiller.",
    )
    .setFooter({ text: `Par ${i.user.tag}` })
    .setTimestamp();

  const ch = await getTextChannel(i);
  if (ch) await ch.send({ embeds: [embed] });
  await i.editReply({ content: locked ? "🔓 Lockdown levé." : "🔒 Lockdown activé." });
}

// ─── /warn ────────────────────────────────────────────────────────────────────
async function handleWarnCmd(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (!i.guild) return;

  const target = i.options.getUser("membre", true);
  const reason = i.options.getString("raison", true);
  const count  = addWarn(i.guild.id, target.id, reason, i.user.id);

  // Auto-mute at 3 warns
  if (count >= 3) {
    try {
      const member = await i.guild.members.fetch(target.id);
      await member.timeout(10 * 60 * 1000, `3 avertissements — ${reason}`);
    } catch {}
  }

  const embed = new EmbedBuilder()
    .setColor(count >= 3 ? DANGER : WARN)
    .setTitle("⚠️  Avertissement")
    .setDescription(count >= 3 ? "🔇 **3 warns atteints — Timeout 10 min appliqué.**" : null)
    .addFields(
      { name: "👤  Membre",     value: `<@${target.id}>`,      inline: true },
      { name: "⚠️  Warn n°",  value: `**${count} / 3**`,      inline: true },
      { name: "📝  Raison",    value: reason,                   inline: false },
      { name: "👮  Par",       value: `<@${i.user.id}>`,       inline: true },
    )
    .setTimestamp();

  const ch = await getTextChannel(i);
  if (ch) await ch.send({ embeds: [embed] });
  await i.editReply({ content: `✅ Avertissement enregistré (${count}/3).` });
}

// ─── /warnings ───────────────────────────────────────────────────────────────
async function handleWarningsCmd(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (!i.guild) return;

  const target = i.options.getUser("membre", true);
  const warns  = getWarns(i.guild.id, target.id);

  if (warns.length === 0) {
    await i.editReply({ content: `✅ <@${target.id}> n'a aucun avertissement.` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(WARN)
    .setTitle(`⚠️  Avertissements de ${target.tag ?? target.username}`)
    .setDescription(
      warns.map((w, idx) =>
        `**#${idx + 1}** — ${w.reason}\n> Par ${w.by === "AUTO" ? "Auto" : `<@${w.by}>`} • <t:${Math.floor(w.at / 1000)}:R>`,
      ).join("\n\n"),
    )
    .setFooter({ text: `Total : ${warns.length} / 3` })
    .setTimestamp();

  await i.editReply({ embeds: [embed] });
}

// ─── /clear-warns ─────────────────────────────────────────────────────────────
async function handleClearWarnsCmd(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (!i.guild) return;

  const target = i.options.getUser("membre", true);
  clearWarns(i.guild.id, target.id);

  await i.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(SUCCESS)
        .setDescription(`🗑️ Les avertissements de <@${target.id}> ont été **effacés** par <@${i.user.id}>.`),
    ],
  });
}

// ─── /avis ───────────────────────────────────────────────────────────────────
async function handleAvis(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const note  = i.options.getInteger("note", true);
  const texte = i.options.getString("commentaire", true);
  const stars = "⭐".repeat(note) + "✩".repeat(5 - note);
  const color = note >= 4 ? SUCCESS : note === 3 ? WARN : DANGER;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: i.user.tag ?? i.user.username, iconURL: i.user.displayAvatarURL() })
    .setTitle("⭐  Nouvel Avis")
    .addFields(
      { name: "Note",          value: `${stars}  **(${note}/5)**`, inline: false },
      { name: "💬  Commentaire", value: `> ${texte}`,              inline: false },
      { name: "✍️  Par",        value: `<@${i.user.id}>`,          inline: true },
    )
    .setFooter({ text: "Merci pour ton retour !" })
    .setTimestamp();

  // Send to reviews channel if configured, else current channel
  let sent = false;
  if (config.reviewsChannelId && i.guild) {
    try {
      const ch = await i.guild.channels.fetch(config.reviewsChannelId) as TextChannel;
      await ch.send({ embeds: [embed] });
      sent = true;
    } catch {}
  }
  if (!sent) {
    const ch = await getTextChannel(i);
    if (ch) await ch.send({ embeds: [embed] });
  }

  await i.editReply({ content: "✅ Ton avis a bien été enregistré, merci !" });
}

// ─── /suggestion ──────────────────────────────────────────────────────────────
async function handleSuggestion(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const idee = i.options.getString("idee", true);

  const embed = new EmbedBuilder()
    .setColor(WARN)
    .setAuthor({ name: `Suggestion de ${i.user.tag ?? i.user.username}`, iconURL: i.user.displayAvatarURL() })
    .setTitle("💡  Nouvelle Suggestion")
    .setDescription(`> ${idee}`)
    .addFields({ name: "Proposé par", value: `<@${i.user.id}>`, inline: true })
    .setFooter({ text: "Votez avec les réactions !" })
    .setTimestamp();

  let msg;
  if (config.suggestionsChannelId && i.guild) {
    try {
      const ch = await i.guild.channels.fetch(config.suggestionsChannelId) as TextChannel;
      msg = await ch.send({ embeds: [embed] });
    } catch {}
  }
  if (!msg) {
    const ch = await getTextChannel(i);
    if (ch) msg = await ch.send({ embeds: [embed] });
  }

  if (msg) {
    await msg.react("✅").catch(() => {});
    await msg.react("❌").catch(() => {});
  }

  await i.editReply({ content: "✅ Ta suggestion a été soumise au vote !" });
}

// ─── /candidature ─────────────────────────────────────────────────────────────
async function handleCandidature(i: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("modal_candidature")
    .setTitle("📋  Formulaire de Candidature");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("cand_age").setLabel("Quel est ton âge ?")
        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("cand_motivation").setLabel("Pourquoi veux-tu rejoindre le staff ?")
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("cand_experience").setLabel("Expérience en modération ?")
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("cand_disponibilite").setLabel("Disponibilité (heures / semaine)")
        .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Ex : 10h par semaine"),
    ),
  );

  await i.showModal(modal);
}

async function handleCandidatureSubmit(i: ModalSubmitInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const age   = i.fields.getTextInputValue("cand_age");
  const motiv = i.fields.getTextInputValue("cand_motivation");
  const exp   = i.fields.getTextInputValue("cand_experience");
  const dispo = i.fields.getTextInputValue("cand_disponibilite");

  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setAuthor({ name: `Candidature de ${i.user.tag ?? i.user.username}`, iconURL: i.user.displayAvatarURL() })
    .setTitle("📋  Nouvelle Candidature Staff")
    .addFields(
      { name: "🎂  Âge",           value: age,         inline: true },
      { name: "⏰  Disponibilité", value: dispo,       inline: true },
      { name: "💪  Motivations",   value: `> ${motiv}` },
      { name: "🛡️  Expériences",  value: `> ${exp}` },
    )
    .setFooter({ text: "Utilisez les boutons pour statuer" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`application_accept:${i.user.id}`).setLabel("Accepter").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`application_refuse:${i.user.id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger),
  );

  let sent = false;
  if (config.applicationsChannelId && i.guild) {
    try {
      const ch = await i.guild.channels.fetch(config.applicationsChannelId) as TextChannel;
      await ch.send({ embeds: [embed], components: [row] });
      sent = true;
    } catch {}
  }
  if (!sent) {
    const ch = await getTextChannel(i);
    if (ch) await ch.send({ embeds: [embed], components: [row] });
  }

  await i.editReply({ content: "✅ Candidature envoyée ! Le staff va l'examiner." });
}

// ─── Application Decision ─────────────────────────────────────────────────────
async function handleApplicationDecision(i: ButtonInteraction, userId: string, accepted: boolean) {
  await i.deferUpdate();

  const orig    = i.message.embeds[0];
  const updated = EmbedBuilder.from(orig)
    .setColor(accepted ? SUCCESS : DANGER)
    .addFields({ name: accepted ? "✅  Accepté par" : "❌  Refusé par", value: `<@${i.user.id}>`, inline: true });

  await i.message.edit({ embeds: [updated], components: [] });

  try {
    const member = await i.guild?.members.fetch(userId);
    await member?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(accepted ? SUCCESS : DANGER)
          .setTitle(accepted ? "🎉  Candidature Acceptée !" : "😔  Candidature Refusée")
          .setDescription(
            accepted
              ? `Félicitations ! Ta candidature sur **${i.guild?.name}** a été **acceptée**. Bienvenue dans l'équipe ! 🚀`
              : `Ta candidature sur **${i.guild?.name}** a été **refusée** cette fois-ci. Ne te décourage pas ! 💪`,
          )
          .setTimestamp(),
      ],
    });
  } catch {}
}
