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
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { saveEmbed, CustomButtonData } from "../store.js";

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

// ─── Safe channel fetch ───────────────────────────────────────────────────────
async function fetchTextChannel(
  interaction: ButtonInteraction | ModalSubmitInteraction | ChatInputCommandInteraction,
): Promise<TextChannel | null> {
  if (!interaction.guild) return null;
  try {
    const ch = await interaction.guild.channels.fetch(interaction.channelId);
    return ch instanceof TextChannel ? ch : null;
  } catch {
    return null;
  }
}

// ─── Color parser ─────────────────────────────────────────────────────────────
function parseColor(colorStr: string): number {
  if (!colorStr) return Colors.Blurple;
  const clean = colorStr.trim().toUpperCase().replace("#", "");
  const parsed = parseInt(clean, 16);
  if (!isNaN(parsed)) return parsed;
  const named = Colors[clean as keyof typeof Colors];
  if (named) return named as number;
  return Colors.Blurple;
}

// ─── /embed-builder command → open modal ─────────────────────────────────────
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

// ─── Modal submit → show preview ─────────────────────────────────────────────
export async function handleEmbedBuilderModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const title        = interaction.fields.getTextInputValue("embed_title");
  const description  = interaction.fields.getTextInputValue("embed_description");
  const colorStr     = interaction.fields.getTextInputValue("embed_color") || "";
  const imageUrl     = interaction.fields.getTextInputValue("embed_image") || "";
  const thumbnailUrl = interaction.fields.getTextInputValue("embed_thumbnail") || "";

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(parseColor(colorStr))
    .setTimestamp();

  if (imageUrl)     { try { embed.setImage(imageUrl); }         catch {} }
  if (thumbnailUrl) { try { embed.setThumbnail(thumbnailUrl); } catch {} }

  const sessionId = `${interaction.user.id}_${Date.now()}`;
  builderSessions.set(sessionId, {
    title, description, color: colorStr, imageUrl, buttons: [],
    channelId: interaction.channelId,
  });

  await interaction.editReply({
    content: "**Aperçu de ton embed :** *(visible uniquement par toi)*",
    embeds: [embed],
    components: [buildControlRow(sessionId, 0)],
  });
}

// ─── Add button → modal ───────────────────────────────────────────────────────
export async function handleEmbedAddButton(
  interaction: ButtonInteraction,
  sessionId: string,
): Promise<void> {
  const session = builderSessions.get(sessionId);
  if (!session) {
    await interaction.reply({ content: "❌ Session expirée. Relance `/embed-builder`.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (session.buttons.length >= 5) {
    await interaction.reply({ content: "❌ Maximum 5 boutons par embed.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(`modal_embed_button:${sessionId}`)
      .setTitle("➕ Ajouter un Bouton")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("btn_label").setLabel("Texte du bouton")
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("btn_emoji").setLabel("Emoji (optionnel, ex: 🎮)")
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(10),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("btn_type").setLabel('Type : "role" ou "link"')
            .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("role"),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("btn_value").setLabel("ID du rôle OU URL du lien")
            .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("ex: 123456789 ou https://discord.gg/..."),
        ),
      ),
  );
}

// ─── Button modal submit → update preview ────────────────────────────────────
export async function handleEmbedButtonModal(
  interaction: ModalSubmitInteraction,
  sessionId: string,
): Promise<void> {
  const session = builderSessions.get(sessionId);
  if (!session) {
    await interaction.reply({ content: "❌ Session expirée.", flags: MessageFlags.Ephemeral });
    return;
  }

  const label    = interaction.fields.getTextInputValue("btn_label");
  const emoji    = interaction.fields.getTextInputValue("btn_emoji") || undefined;
  const typeRaw  = interaction.fields.getTextInputValue("btn_type").toLowerCase().trim();
  const value    = interaction.fields.getTextInputValue("btn_value").trim();
  const type     = typeRaw === "link" ? "link" : "role";

  session.buttons.push({
    customId: type === "role" ? `embed_role:${value}` : `embed_link_noop:${Date.now()}`,
    label, emoji, type,
    roleId: type === "role" ? value : undefined,
    url:    type === "link" ? value : undefined,
  });

  await interaction.deferUpdate();
  await interaction.editReply({
    content: `**Aperçu (${session.buttons.length} bouton(s) ajouté(s)) :**`,
    embeds:  [buildPreviewEmbed(session)],
    components: [...buildButtonRows(session), buildControlRow(sessionId, session.buttons.length)],
  });
}

// ─── Publish ──────────────────────────────────────────────────────────────────
export async function handleEmbedPublish(
  interaction: ButtonInteraction,
  sessionId: string,
): Promise<void> {
  const session = builderSessions.get(sessionId);
  if (!session) {
    await interaction.reply({ content: "❌ Session expirée. Relance `/embed-builder`.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();

  const channel = await fetchTextChannel(interaction);
  if (!channel) {
    await interaction.editReply({ content: "❌ Impossible d'accéder au salon.", embeds: [], components: [] });
    return;
  }

  const published = await channel.send({
    embeds: [buildPreviewEmbed(session)],
    components: buildButtonRows(session),
  });

  await saveEmbed(published.id, {
    messageId: published.id,
    channelId: channel.id,
    guildId:   interaction.guildId!,
    buttons:   session.buttons,
  });

  builderSessions.delete(sessionId);

  await interaction.editReply({
    content: `✅ Embed publié dans <#${channel.id}> !`,
    embeds: [],
    components: [],
  });
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
export async function handleEmbedCancel(
  interaction: ButtonInteraction,
  sessionId: string,
): Promise<void> {
  builderSessions.delete(sessionId);
  await interaction.update({ content: "❌ Création d'embed annulée.", embeds: [], components: [] });
}

// ─── Role button ──────────────────────────────────────────────────────────────
export async function handleEmbedRoleButton(
  interaction: ButtonInteraction,
  roleId: string,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Serveur introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  let member;
  try {
    member = await interaction.guild.members.fetch(interaction.user.id);
  } catch {
    await interaction.reply({ content: "❌ Impossible de récupérer ton profil.", flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await interaction.reply({ content: `✅ Le rôle <@&${roleId}> t'a été **retiré**.`, flags: MessageFlags.Ephemeral });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({ content: `✅ Le rôle <@&${roleId}> t'a été **attribué** !`, flags: MessageFlags.Ephemeral });
    }
  } catch {
    await interaction.reply({ content: "❌ Impossible de modifier le rôle. Vérifie les permissions du bot.", flags: MessageFlags.Ephemeral });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildPreviewEmbed(session: { title: string; description: string; color: string; imageUrl: string }): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(session.title)
    .setDescription(session.description)
    .setColor(parseColor(session.color))
    .setTimestamp();
  if (session.imageUrl) { try { embed.setImage(session.imageUrl); } catch {} }
  return embed;
}

function buildButtonRows(session: { buttons: CustomButtonData[] }): ActionRowBuilder<ButtonBuilder>[] {
  if (session.buttons.length === 0) return [];
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const btn of session.buttons) {
    if (btn.type === "link" && btn.url) {
      const b = new ButtonBuilder().setLabel(btn.label).setStyle(ButtonStyle.Link).setURL(btn.url);
      if (btn.emoji) b.setEmoji(btn.emoji);
      row.addComponents(b);
    } else {
      const b = new ButtonBuilder().setCustomId(btn.customId).setLabel(btn.label).setStyle(ButtonStyle.Primary);
      if (btn.emoji) b.setEmoji(btn.emoji);
      row.addComponents(b);
    }
  }
  return [row];
}

function buildControlRow(sessionId: string, btnCount: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`embed_add_button:${sessionId}`).setLabel("Ajouter un bouton").setEmoji("➕")
      .setStyle(ButtonStyle.Secondary).setDisabled(btnCount >= 5),
    new ButtonBuilder().setCustomId(`embed_publish:${sessionId}`).setLabel("Publier").setEmoji("📤").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`embed_cancel:${sessionId}`).setLabel("Annuler").setEmoji("❌").setStyle(ButtonStyle.Danger),
  );
}
