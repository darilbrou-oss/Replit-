import {
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  Colors,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { getEmbed, saveEmbed, CustomButtonData } from "../store.js";

const builderSessions = new Map<
  string,
  {
    title: string;
    description: string;
    color: string;
    imageUrl: string;
    buttons: CustomButtonData[];
    channelId: string;
  }
>();

export async function handleEmbedBuilderCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_embed_builder")
    .setTitle("🛠️ Créer un Embed");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("embed_title")
        .setLabel("Titre de l'embed")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("embed_description")
        .setLabel("Description")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("embed_color")
        .setLabel("Couleur (ex: #FF0000 ou RED)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("#5865F2"),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("embed_image")
        .setLabel("URL de l'image (optionnel)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("embed_thumbnail")
        .setLabel("URL du thumbnail (optionnel)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false),
    ),
  );

  await interaction.showModal(modal);
}

function parseColor(colorStr: string): number {
  if (!colorStr) return Colors.Blurple;
  const clean = colorStr.trim().toUpperCase().replace("#", "");
  const parsed = parseInt(clean, 16);
  if (!isNaN(parsed)) return parsed;
  const named = Colors[clean as keyof typeof Colors];
  if (named) return named as number;
  return Colors.Blurple;
}

export async function handleEmbedBuilderModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue("embed_title");
  const description = interaction.fields.getTextInputValue("embed_description");
  const colorStr = interaction.fields.getTextInputValue("embed_color") || "";
  const imageUrl = interaction.fields.getTextInputValue("embed_image") || "";
  const thumbnailUrl =
    interaction.fields.getTextInputValue("embed_thumbnail") || "";

  const color = parseColor(colorStr);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (imageUrl) {
    try {
      embed.setImage(imageUrl);
    } catch {}
  }
  if (thumbnailUrl) {
    try {
      embed.setThumbnail(thumbnailUrl);
    } catch {}
  }

  const sessionId = `${interaction.user.id}_${Date.now()}`;
  builderSessions.set(sessionId, {
    title,
    description,
    color: colorStr,
    imageUrl,
    buttons: [],
    channelId: interaction.channelId,
  });

  const previewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_add_button:${sessionId}`)
      .setLabel("Ajouter un bouton")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_publish:${sessionId}`)
      .setLabel("Publier")
      .setEmoji("📤")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embed_cancel:${sessionId}`)
      .setLabel("Annuler")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({
    content: "**Aperçu de ton embed :** *(visible uniquement par toi)*",
    embeds: [embed],
    components: [previewRow],
  });
}

export async function handleEmbedAddButton(
  interaction: ButtonInteraction,
  sessionId: string,
): Promise<void> {
  const session = builderSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: "❌ Session expirée. Relance `/embed-builder`.",
      ephemeral: true,
    });
    return;
  }

  if (session.buttons.length >= 5) {
    await interaction.reply({
      content: "❌ Maximum 5 boutons par embed.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_embed_button:${sessionId}`)
    .setTitle("➕ Ajouter un Bouton");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("btn_label")
        .setLabel("Texte du bouton")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("btn_emoji")
        .setLabel("Emoji (optionnel, ex: 🎮)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("btn_type")
        .setLabel('Type : "role" ou "link"')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("role"),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("btn_value")
        .setLabel("ID du rôle OU URL du lien")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("ex: 123456789 ou https://discord.gg/..."),
    ),
  );

  await interaction.showModal(modal);
}

export async function handleEmbedButtonModal(
  interaction: ModalSubmitInteraction,
  sessionId: string,
): Promise<void> {
  const session = builderSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: "❌ Session expirée.",
      ephemeral: true,
    });
    return;
  }

  const label = interaction.fields.getTextInputValue("btn_label");
  const emoji = interaction.fields.getTextInputValue("btn_emoji") || undefined;
  const typeRaw = interaction.fields.getTextInputValue("btn_type").toLowerCase().trim();
  const value = interaction.fields.getTextInputValue("btn_value").trim();

  const type = typeRaw === "link" ? "link" : "role";

  const btnData: CustomButtonData = {
    customId:
      type === "role"
        ? `embed_role:${value}`
        : `embed_link_noop:${Date.now()}`,
    label,
    emoji,
    type,
    roleId: type === "role" ? value : undefined,
    url: type === "link" ? value : undefined,
  };

  session.buttons.push(btnData);

  await interaction.deferUpdate();

  const previewEmbed = buildPreviewEmbed(session);
  const previewComponents = buildPreviewComponents(session, sessionId);

  await interaction.editReply({
    content: `**Aperçu (${session.buttons.length} bouton(s) ajouté(s)) :**`,
    embeds: [previewEmbed],
    components: previewComponents,
  });
}

function buildPreviewEmbed(session: {
  title: string;
  description: string;
  color: string;
  imageUrl: string;
  buttons: CustomButtonData[];
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(session.title)
    .setDescription(session.description)
    .setColor(parseColor(session.color))
    .setTimestamp();

  if (session.imageUrl) {
    try {
      embed.setImage(session.imageUrl);
    } catch {}
  }

  return embed;
}

function buildPreviewComponents(
  session: { buttons: CustomButtonData[] },
  sessionId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (session.buttons.length > 0) {
    const btnRow = new ActionRowBuilder<ButtonBuilder>();
    for (const btn of session.buttons) {
      if (btn.type === "link" && btn.url) {
        const b = new ButtonBuilder()
          .setLabel(btn.label)
          .setStyle(ButtonStyle.Link)
          .setURL(btn.url);
        if (btn.emoji) b.setEmoji(btn.emoji);
        btnRow.addComponents(b);
      } else {
        const b = new ButtonBuilder()
          .setCustomId(btn.customId)
          .setLabel(btn.label)
          .setStyle(ButtonStyle.Primary);
        if (btn.emoji) b.setEmoji(btn.emoji);
        btnRow.addComponents(b);
      }
    }
    rows.push(btnRow);
  }

  const ctrlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_add_button:${sessionId}`)
      .setLabel("Ajouter un bouton")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.buttons.length >= 5),
    new ButtonBuilder()
      .setCustomId(`embed_publish:${sessionId}`)
      .setLabel("Publier")
      .setEmoji("📤")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embed_cancel:${sessionId}`)
      .setLabel("Annuler")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),
  );
  rows.push(ctrlRow);

  return rows;
}

export async function handleEmbedPublish(
  interaction: ButtonInteraction,
  sessionId: string,
): Promise<void> {
  const session = builderSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: "❌ Session expirée. Relance `/embed-builder`.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const channel = interaction.channel as TextChannel;
  const finalEmbed = buildPreviewEmbed(session);

  const publishRows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (session.buttons.length > 0) {
    const btnRow = new ActionRowBuilder<ButtonBuilder>();
    for (const btn of session.buttons) {
      if (btn.type === "link" && btn.url) {
        const b = new ButtonBuilder()
          .setLabel(btn.label)
          .setStyle(ButtonStyle.Link)
          .setURL(btn.url);
        if (btn.emoji) b.setEmoji(btn.emoji);
        btnRow.addComponents(b);
      } else {
        const b = new ButtonBuilder()
          .setCustomId(btn.customId)
          .setLabel(btn.label)
          .setStyle(ButtonStyle.Primary);
        if (btn.emoji) b.setEmoji(btn.emoji);
        btnRow.addComponents(b);
      }
    }
    publishRows.push(btnRow);
  }

  const published = await channel.send({
    embeds: [finalEmbed],
    components: publishRows,
  });

  await saveEmbed(published.id, {
    messageId: published.id,
    channelId: channel.id,
    guildId: interaction.guildId!,
    buttons: session.buttons,
  });

  builderSessions.delete(sessionId);

  await interaction.editReply({
    content: `✅ Embed publié avec succès dans <#${channel.id}> !`,
    embeds: [],
    components: [],
  });
}

export async function handleEmbedCancel(
  interaction: ButtonInteraction,
  sessionId: string,
): Promise<void> {
  builderSessions.delete(sessionId);
  await interaction.update({
    content: "❌ Création d'embed annulée.",
    embeds: [],
    components: [],
  });
}

export async function handleEmbedRoleButton(
  interaction: ButtonInteraction,
  roleId: string,
): Promise<void> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  if (!member) {
    await interaction.reply({ content: "❌ Impossible de récupérer ton profil.", ephemeral: true });
    return;
  }

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await interaction.reply({
        content: `✅ Le rôle <@&${roleId}> t'a été **retiré**.`,
        ephemeral: true,
      });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({
        content: `✅ Le rôle <@&${roleId}> t'a été **attribué** !`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("Role button error:", err);
    await interaction.reply({
      content: "❌ Impossible de modifier le rôle. Vérifie les permissions du bot.",
      ephemeral: true,
    });
  }
}
