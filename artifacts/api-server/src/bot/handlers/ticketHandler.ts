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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  Colors,
} from "discord.js";
import {
  getTicket,
  saveTicket,
  deleteTicket,
  nextTicketNumber,
  TicketPriority,
} from "../store.js";
import config from "../../config.js";

const PRIORITY_COLORS: Record<TicketPriority, number> = {
  high: Colors.Red,
  medium: Colors.Yellow,
  low: Colors.Green,
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  high: "🔴 Haute",
  medium: "🟡 Moyenne",
  low: "🟢 Basse",
};

function buildStaffPanel(
  ticket: NonNullable<ReturnType<typeof getTicket>>,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const priority = ticket.priority;
  const claimedBy = ticket.claimedBy;

  const embed = new EmbedBuilder()
    .setTitle("🎫 Panneau de Contrôle — Staff")
    .setColor(PRIORITY_COLORS[priority])
    .addFields(
      {
        name: "👤 Utilisateur",
        value: `<@${ticket.userId}>`,
        inline: true,
      },
      {
        name: "📊 Priorité",
        value: PRIORITY_LABELS[priority],
        inline: true,
      },
      {
        name: "✋ Pris en charge par",
        value: claimedBy ? `<@${claimedBy}>` : "Personne",
        inline: true,
      },
      {
        name: "🕐 Créé le",
        value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`,
        inline: true,
      },
    )
    .setFooter({ text: `Ticket #${ticket.ticketNumber}` })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close:${ticket.channelId}`)
      .setLabel("Fermer")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_claim:${ticket.channelId}`)
      .setLabel(claimedBy ? "Libérer" : "Claim")
      .setEmoji("✋")
      .setStyle(claimedBy ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_notify:${ticket.channelId}`)
      .setLabel("Notification")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_priority_high:${ticket.channelId}`)
      .setLabel("Haute")
      .setEmoji("🔴")
      .setStyle(
        priority === "high" ? ButtonStyle.Danger : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId(`ticket_priority_medium:${ticket.channelId}`)
      .setLabel("Moyenne")
      .setEmoji("🟡")
      .setStyle(
        priority === "medium" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId(`ticket_priority_low:${ticket.channelId}`)
      .setLabel("Basse")
      .setEmoji("🟢")
      .setStyle(
        priority === "low" ? ButtonStyle.Success : ButtonStyle.Secondary,
      ),
  );

  return { embeds: [embed], components: [row1, row2] };
}

export async function handleCreateTicketButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_ticket_create")
    .setTitle("🎫 Créer un Ticket");

  const reasonInput = new TextInputBuilder()
    .setCustomId("ticket_reason")
    .setLabel("Raison de votre ticket")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Décrivez votre problème ou votre demande...")
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
  );

  await interaction.showModal(modal);
}

export async function handleCreateTicketModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) return;

  const reason =
    interaction.fields.getTextInputValue("ticket_reason") || "Aucune raison";

  const ticketNumber = nextTicketNumber();
  const channelName = `ticket-${ticketNumber.toString().padStart(4, "0")}`;

  try {
    const categoryId = config.ticketCategoryId;
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        ...(config.staffRoleId
          ? [
              {
                id: config.staffRoleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                ],
              },
            ]
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

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 Ticket #${ticketNumber.toString().padStart(4, "0")}`)
      .setColor(Colors.Blurple)
      .setDescription(
        `Bonjour <@${interaction.user.id}> ! 👋\n\nMerci d'avoir ouvert un ticket. Notre équipe va vous répondre dès que possible.\n\n**Raison :**\n> ${reason}`,
      )
      .setFooter({ text: "Merci de patienter ⏳" })
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });

    const panel = buildStaffPanel(ticketData);
    const controlMsg = await channel.send({
      content: config.staffRoleId ? `<@&${config.staffRoleId}>` : undefined,
      ...panel,
    });

    ticketData.controlPanelMessageId = controlMsg.id;
    await saveTicket(channel.id, ticketData);

    await interaction.editReply({
      content: `✅ Ton ticket a été créé : <#${channel.id}>`,
    });
  } catch (err) {
    console.error("Error creating ticket channel:", err);
    await interaction.editReply({
      content: "❌ Erreur lors de la création du ticket. Réessaie plus tard.",
    });
  }
}

export async function handleTicketClose(
  interaction: ButtonInteraction,
  channelId: string,
): Promise<void> {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({
      content: "❌ Ce ticket n'existe plus dans la base de données.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content:
      "🔒 Le ticket sera **fermé et supprimé** dans **5 secondes**...\n> Toute l'équipe peut annuler si nécessaire.",
  });

  const channel = interaction.channel as TextChannel;

  setTimeout(async () => {
    try {
      if (config.ticketLogChannelId) {
        const logChannel = interaction.guild?.channels.cache.get(
          config.ticketLogChannelId,
        ) as TextChannel | undefined;

        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(
              `📁 Ticket #${ticket.ticketNumber.toString().padStart(4, "0")} — Fermé`,
            )
            .setColor(Colors.Red)
            .addFields(
              { name: "👤 Utilisateur", value: `<@${ticket.userId}>`, inline: true },
              {
                name: "✋ Pris en charge",
                value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Personne",
                inline: true,
              },
              { name: "📊 Priorité", value: PRIORITY_LABELS[ticket.priority], inline: true },
              {
                name: "⏱️ Durée",
                value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`,
                inline: true,
              },
              { name: "🔒 Fermé par", value: `<@${interaction.user.id}>`, inline: true },
            )
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      }

      await deleteTicket(channelId);
      await channel.delete("Ticket fermé");
    } catch (err) {
      console.error("Error closing ticket:", err);
    }
  }, 5000);
}

export async function handleTicketClaim(
  interaction: ButtonInteraction,
  channelId: string,
): Promise<void> {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });
    return;
  }

  if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
    await interaction.reply({
      content: `❌ Ce ticket est déjà pris en charge par <@${ticket.claimedBy}>.`,
      ephemeral: true,
    });
    return;
  }

  const wasClaimed = ticket.claimedBy === interaction.user.id;
  ticket.claimedBy = wasClaimed ? null : interaction.user.id;
  await saveTicket(channelId, ticket);

  if (wasClaimed) {
    await interaction.reply({
      content: `↩️ <@${interaction.user.id}> a libéré ce ticket.`,
    });
  } else {
    await interaction.reply({
      content: `✋ <@${interaction.user.id}> prend en charge ce ticket ! Les autres modérateurs peuvent laisser ce ticket.`,
    });

    const channel = interaction.channel as TextChannel;
    if (config.staffRoleId) {
      await channel.permissionOverwrites.edit(config.staffRoleId, {
        SendMessages: false,
      });
      await channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true,
      });
    }
  }

  if (ticket.controlPanelMessageId) {
    try {
      const channel = interaction.channel as TextChannel;
      const msg = await channel.messages.fetch(ticket.controlPanelMessageId);
      const panel = buildStaffPanel(ticket);
      await msg.edit(panel);
    } catch {}
  }
}

export async function handleTicketNotify(
  interaction: ButtonInteraction,
  channelId: string,
): Promise<void> {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `🔔 <@${ticket.userId}> — L'équipe attend votre réponse ! Merci de vous manifester.`,
  });
}

export async function handleTicketPriority(
  interaction: ButtonInteraction,
  channelId: string,
  priority: TicketPriority,
): Promise<void> {
  const ticket = getTicket(channelId);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });
    return;
  }

  ticket.priority = priority;
  await saveTicket(channelId, ticket);

  await interaction.reply({
    content: `📊 Priorité mise à jour : **${PRIORITY_LABELS[priority]}**`,
    ephemeral: true,
  });

  if (ticket.controlPanelMessageId) {
    try {
      const channel = interaction.channel as TextChannel;
      const msg = await channel.messages.fetch(ticket.controlPanelMessageId);
      const panel = buildStaffPanel(ticket);
      await msg.edit(panel);
    } catch {}
  }
}
