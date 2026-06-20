import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  getTicket,
  saveTicket,
  deleteTicket,
  nextTicketNumber,
  TicketPriority,
} from "../store.js";
import config from "../../config.js";

// ─── Branding ───────────────────────────────────────────────────────────────
const BRAND_COLOR  = 0x5865F2; // Blurple Discord
const DANGER_COLOR = 0xED4245;
const WARN_COLOR   = 0xFEE75C;
const SUCCESS_COLOR = 0x57F287;

const PRIORITY_META: Record<TicketPriority, { color: number; label: string; emoji: string }> = {
  high:   { color: DANGER_COLOR,  label: "Haute",   emoji: "🔴" },
  medium: { color: WARN_COLOR,    label: "Moyenne",  emoji: "🟡" },
  low:    { color: SUCCESS_COLOR, label: "Basse",    emoji: "🟢" },
};

// ─── Staff Panel Builder ─────────────────────────────────────────────────────
function buildStaffPanel(ticket: NonNullable<ReturnType<typeof getTicket>>) {
  const pm = PRIORITY_META[ticket.priority];

  const embed = new EmbedBuilder()
    .setColor(pm.color)
    .setAuthor({ name: `🎫  Ticket #${String(ticket.ticketNumber).padStart(4, "0")}  •  Panneau Staff` })
    .setDescription(
      ticket.claimedBy
        ? `> Ce ticket est géré par <@${ticket.claimedBy}>.\n> Les autres modérateurs peuvent passer à autre chose. ✅`
        : "> Aucun membre du staff n'a encore pris en charge ce ticket.",
    )
    .addFields(
      { name: "👤  Utilisateur",   value: `<@${ticket.userId}>`,              inline: true },
      { name: `${pm.emoji}  Priorité`, value: `**${pm.label}**`,             inline: true },
      { name: "✋  Pris en charge", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "*Personne*", inline: true },
      { name: "🕐  Ouvert",         value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: "Utilisez les boutons ci-dessous pour gérer ce ticket" })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close:${ticket.channelId}`)
      .setLabel("Fermer")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_claim:${ticket.channelId}`)
      .setLabel(ticket.claimedBy ? "Libérer" : "Claim")
      .setEmoji("✋")
      .setStyle(ticket.claimedBy ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_notify:${ticket.channelId}`)
      .setLabel("Notifier")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_priority_high:${ticket.channelId}`)
      .setLabel("Haute")
      .setEmoji("🔴")
      .setStyle(ticket.priority === "high" ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket_priority_medium:${ticket.channelId}`)
      .setLabel("Moyenne")
      .setEmoji("🟡")
      .setStyle(ticket.priority === "medium" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket_priority_low:${ticket.channelId}`)
      .setLabel("Basse")
      .setEmoji("🟢")
      .setStyle(ticket.priority === "low" ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

// ─── Create Ticket — Button ──────────────────────────────────────────────────
export async function handleCreateTicketButton(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("modal_ticket_create")
    .setTitle("📩  Ouvrir un Ticket");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("ticket_reason")
        .setLabel("Décris ton problème ou ta demande")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Ex : J'ai un problème avec ma commande n°1234...")
        .setMinLength(10)
        .setMaxLength(500)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

// ─── Create Ticket — Modal ───────────────────────────────────────────────────
export async function handleCreateTicketModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) return;

  const reason = interaction.fields.getTextInputValue("ticket_reason");
  const ticketNumber = nextTicketNumber();
  const channelName = `ticket-${String(ticketNumber).padStart(4, "0")}`;

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId || undefined,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        ...(config.staffRoleId
          ? [{
              id: config.staffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
              ],
            }]
          : []),
      ],
    });

    const ticketData = {
      userId: interaction.user.id,
      guildId: guild.id,
      channelId: channel.id,
      claimedBy: null,
      priority: "medium" as TicketPriority,
      createdAt: Date.now(),
      controlPanelMessageId: null,
      ticketNumber,
    };

    await saveTicket(channel.id, ticketData);

    // ── Welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setAuthor({ name: `Ticket #${String(ticketNumber).padStart(4, "0")}`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle("Bienvenue dans ton ticket ! 👋")
      .setDescription(
        `Bonjour <@${interaction.user.id}>, merci d'avoir contacté le support.\nNotre équipe va te répondre **dès que possible**.\n\n📝 **Raison :**\n> ${reason}`,
      )
      .addFields(
        { name: "⏳  Temps de réponse estimé", value: "Aussi vite que possible", inline: true },
        { name: "📌  Conseils",                value: "Sois précis pour une aide rapide", inline: true },
      )
      .setFooter({ text: "Ne ferme pas ce salon — le staff va arriver" })
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });

    // ── Staff panel
    const panel = buildStaffPanel(ticketData);
    const controlMsg = await channel.send({
      content: config.staffRoleId ? `<@&${config.staffRoleId}>` : undefined,
      ...panel,
    });

    ticketData.controlPanelMessageId = controlMsg.id;
    await saveTicket(channel.id, ticketData);

    await interaction.editReply({
      content: `✅ **Ticket ouvert avec succès !**\nTu peux y accéder ici → <#${channel.id}>`,
    });
  } catch (err) {
    console.error("Error creating ticket:", err);
    await interaction.editReply({ content: "❌ Impossible de créer le ticket. Réessaie." });
  }
}

// ─── Close Ticket ────────────────────────────────────────────────────────────
export async function handleTicketClose(interaction: ButtonInteraction, channelId: string) {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });
    return;
  }

  const countdown = new EmbedBuilder()
    .setColor(DANGER_COLOR)
    .setTitle("🔒  Fermeture du Ticket")
    .setDescription(
      `Ce ticket sera **supprimé dans 5 secondes**.\n> Fermé par <@${interaction.user.id}>`,
    )
    .setTimestamp();

  await interaction.reply({ embeds: [countdown] });

  setTimeout(async () => {
    try {
      const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel | undefined;

      // ── Log
      if (config.ticketLogChannelId) {
        const logCh = interaction.guild?.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
        if (logCh) {
          const pm = PRIORITY_META[ticket.priority];
          await logCh.send({
            embeds: [
              new EmbedBuilder()
                .setColor(DANGER_COLOR)
                .setAuthor({ name: `📁  Ticket #${String(ticket.ticketNumber).padStart(4, "0")} — Archivé` })
                .addFields(
                  { name: "👤  Utilisateur",      value: `<@${ticket.userId}>`,                                          inline: true },
                  { name: "✋  Pris en charge",   value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "*Personne*",   inline: true },
                  { name: `${pm.emoji}  Priorité`, value: pm.label,                                                     inline: true },
                  { name: "⏱️  Ouvert",            value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`,               inline: true },
                  { name: "🔒  Fermé par",         value: `<@${interaction.user.id}>`,                                  inline: true },
                )
                .setTimestamp(),
            ],
          });
        }
      }

      await deleteTicket(channelId);
      await channel?.delete("Ticket fermé");
    } catch (e) {
      console.error("Error closing ticket:", e);
    }
  }, 5000);
}

// ─── Claim Ticket ────────────────────────────────────────────────────────────
export async function handleTicketClaim(interaction: ButtonInteraction, channelId: string) {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });
    return;
  }

  if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
    await interaction.reply({
      content: `❌ Ce ticket est déjà géré par <@${ticket.claimedBy}>.`,
      ephemeral: true,
    });
    return;
  }

  const releasing = ticket.claimedBy === interaction.user.id;
  ticket.claimedBy = releasing ? null : interaction.user.id;
  await saveTicket(channelId, ticket);

  const embed = new EmbedBuilder()
    .setColor(releasing ? 0x99AAB5 : SUCCESS_COLOR)
    .setDescription(
      releasing
        ? `↩️ <@${interaction.user.id}> a **libéré** ce ticket. Un autre membre du staff peut le prendre.`
        : `✅ <@${interaction.user.id}> **prend en charge** ce ticket.\n> Les autres modérateurs peuvent passer à autre chose.`,
    );

  await interaction.reply({ embeds: [embed] });

  // Block other staff if claimed
  if (!releasing && config.staffRoleId) {
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(config.staffRoleId, { SendMessages: false }).catch(() => {});
    await channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true,
    }).catch(() => {});
  }

  // Refresh panel
  if (ticket.controlPanelMessageId) {
    try {
      const ch = interaction.channel as TextChannel;
      const msg = await ch.messages.fetch(ticket.controlPanelMessageId);
      await msg.edit(buildStaffPanel(ticket));
    } catch {}
  }
}

// ─── Notify User ─────────────────────────────────────────────────────────────
export async function handleTicketNotify(interaction: ButtonInteraction, channelId: string) {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setTitle("🔔  Rappel du Support")
    .setDescription(
      `Bonjour <@${ticket.userId}> !\nNotre équipe attend ta réponse. **N'hésite pas à répondre ici.** 😊`,
    );

  await interaction.reply({ embeds: [embed] });
}

// ─── Set Priority ─────────────────────────────────────────────────────────────
export async function handleTicketPriority(
  interaction: ButtonInteraction,
  channelId: string,
  priority: TicketPriority,
) {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });
    return;
  }

  ticket.priority = priority;
  await saveTicket(channelId, ticket);

  const pm = PRIORITY_META[priority];
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(pm.color)
        .setDescription(`${pm.emoji} Priorité mise à jour → **${pm.label}**`),
    ],
    ephemeral: true,
  });

  if (ticket.controlPanelMessageId) {
    try {
      const ch = interaction.channel as TextChannel;
      const msg = await ch.messages.fetch(ticket.controlPanelMessageId);
      await msg.edit(buildStaffPanel(ticket));
    } catch {}
  }
}
