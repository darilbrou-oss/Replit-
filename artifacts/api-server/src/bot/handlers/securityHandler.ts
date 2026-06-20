/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SECURITY HANDLER — Anti-Raid · Anti-Spam · Anti-Links · Anti-Fake Accounts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  GuildMember,
  Message,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
  Guild,
  ChannelType,
} from "discord.js";
import config from "../../config.js";

// ─── Constants ───────────────────────────────────────────────────────────────
const SPAM_THRESHOLD    = 4;      // messages
const SPAM_WINDOW_MS    = 3000;   // 3 seconds
const WARN_MUTE_AT      = 3;      // 3 warns → 10-min timeout
const MUTE_DURATION_MS  = 10 * 60 * 1000;
const RAID_THRESHOLD    = 5;      // joins
const RAID_WINDOW_MS    = 10_000; // 10 seconds
const MIN_ACCOUNT_AGE   = 5 * 24 * 60 * 60 * 1000; // 5 days

const DISCORD_INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/gi;

// ─── In-memory stores ─────────────────────────────────────────────────────────
// spam:  userId → { count, windowStart }
const spamMap = new Map<string, { count: number; windowStart: number }>();

// warns: guildId+userId → warn list
const warnMap = new Map<string, Array<{ reason: string; by: string; at: number }>>();

// raid:  guildId → join timestamps
const raidMap = new Map<string, number[]>();

// lockdown state: guildId → boolean
const lockdownState = new Map<string, boolean>();

// ─── Helper: log embed to staff channel ──────────────────────────────────────
async function sendLog(guild: Guild, embed: EmbedBuilder) {
  if (!config.ticketLogChannelId) return;
  try {
    const ch = guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
    await ch?.send({ embeds: [embed] });
  } catch {}
}

// ─── Anti-Fake Account + Welcome + Auto-role ─────────────────────────────────
export async function handleMemberJoin(member: GuildMember) {
  const { guild, user } = member;

  // 1. Anti-raid: record this join
  if (await checkRaid(member)) return; // member was kicked in checkRaid

  // 2. Anti-fake: kick accounts younger than MIN_ACCOUNT_AGE
  const accountAge = Date.now() - user.createdTimestamp;
  if (accountAge < MIN_ACCOUNT_AGE) {
    const days = Math.floor(accountAge / (24 * 60 * 60 * 1000));
    try {
      await member.kick(`Compte trop récent (${days} jour(s) — minimum 5 jours requis)`);
      await sendLog(
        guild,
        new EmbedBuilder()
          .setColor(0xED4245)
          .setAuthor({ name: "🚫  Compte Récent — Kick Automatique" })
          .addFields(
            { name: "👤  Utilisateur", value: `${user.tag} (${user.id})`, inline: true },
            { name: "📅  Compte créé",  value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: "⚠️  Raison",       value: `Compte âgé de seulement **${days} jour(s)**`, inline: false },
          )
          .setTimestamp(),
      );
    } catch {}
    return;
  }

  // 3. Auto-role
  if (config.autoRoleId) {
    try {
      await member.roles.add(config.autoRoleId);
    } catch {}
  }

  // 4. Welcome message
  if (config.welcomeChannelId) {
    try {
      const ch = guild.channels.cache.get(config.welcomeChannelId) as TextChannel | undefined;
      if (ch) {
        const memberCount = guild.memberCount;
        await ch.send({
          content: `<@${user.id}>`,
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setAuthor({ name: `Bienvenue sur ${guild.name} !`, iconURL: guild.iconURL() ?? undefined })
              .setTitle(`👋  Salut ${user.username} !`)
              .setDescription(
                `Tu es le **${memberCount}ème membre** de ce serveur.\n\n` +
                `Lis bien le règlement et passe un agréable séjour parmi nous ! 🎉`,
              )
              .setThumbnail(user.displayAvatarURL({ size: 256 }))
              .addFields(
                { name: "📅  Compte créé",     value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "👥  Membres total",    value: `**${memberCount}**`,                                  inline: true },
              )
              .setFooter({ text: `ID : ${user.id}` })
              .setTimestamp(),
          ],
        });
      }
    } catch {}
  }
}

// ─── Anti-Raid: Mass Join Detection ──────────────────────────────────────────
async function checkRaid(member: GuildMember): Promise<boolean> {
  const { guild } = member;
  const now = Date.now();

  const joins = raidMap.get(guild.id) ?? [];
  const recent = joins.filter((t) => now - t < RAID_WINDOW_MS);
  recent.push(now);
  raidMap.set(guild.id, recent);

  if (recent.length >= RAID_THRESHOLD) {
    // Already in lockdown — just kick the new arrival
    if (lockdownState.get(guild.id)) {
      try { await member.kick("Anti-Raid : serveur en Lockdown"); } catch {}
      return true;
    }

    // Trigger lockdown
    lockdownState.set(guild.id, true);
    await activateLockdown(guild, true);

    // Try to kick the suspect
    try { await member.kick("Anti-Raid : masse de connexions détectée"); } catch {}

    await sendLog(
      guild,
      new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: "🚨  ANTI-RAID — Lockdown Activé" })
        .setDescription(
          `**${recent.length} comptes** ont rejoint en moins de **10 secondes** !\n` +
          `Le serveur est passé en mode **Lockdown** automatique.\n\n` +
          `Utilisez \`/lockdown\` pour déverrouiller manuellement.`,
        )
        .setTimestamp(),
    );

    return true;
  }
  return false;
}

// ─── Lockdown: lock/unlock all text channels ─────────────────────────────────
export async function activateLockdown(guild: Guild, lock: boolean) {
  lockdownState.set(guild.id, lock);
  const everyone = guild.roles.everyone;

  for (const [, channel] of guild.channels.cache) {
    if (channel.type !== ChannelType.GuildText) continue;
    try {
      await (channel as TextChannel).permissionOverwrites.edit(everyone, {
        SendMessages: lock ? false : null,
      });
    } catch {}
  }
}

export function getLockdownState(guildId: string) {
  return lockdownState.get(guildId) ?? false;
}

// ─── Anti-Spam + Anti-Links ──────────────────────────────────────────────────
export async function handleMessageSecurity(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  // Skip staff
  const member = message.member;
  if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  // 1. Anti-invite links
  if (DISCORD_INVITE_REGEX.test(message.content)) {
    try { await message.delete(); } catch {}
    await warn(
      message,
      message.author.id,
      "Envoi d'un lien d'invitation Discord",
      `⛔ <@${message.author.id}>, les liens d'invitation Discord sont **interdits** sur ce serveur.`,
    );
    return;
  }

  // 2. Anti-spam
  const key  = message.author.id;
  const now  = Date.now();
  const data = spamMap.get(key) ?? { count: 0, windowStart: now };

  if (now - data.windowStart > SPAM_WINDOW_MS) {
    data.count = 1;
    data.windowStart = now;
  } else {
    data.count += 1;
  }
  spamMap.set(key, data);

  if (data.count > SPAM_THRESHOLD) {
    data.count = 0;
    spamMap.set(key, data);

    // Delete recent spam messages (up to last 10)
    try {
      const msgs = await message.channel.messages.fetch({ limit: 10 });
      const toDelete = msgs.filter((m) => m.author.id === message.author.id);
      if (message.channel instanceof TextChannel) {
        await (message.channel as TextChannel).bulkDelete(toDelete).catch(() => {});
      }
    } catch {}

    await warn(
      message,
      message.author.id,
      "Spam (plus de 4 messages en 3 secondes)",
      `⚠️ <@${message.author.id}>, tu envoies des messages trop vite. Ralentis !`,
    );
  }
}

// ─── Warn System ─────────────────────────────────────────────────────────────
async function warn(
  message: Message,
  userId: string,
  reason: string,
  publicMsg: string,
) {
  if (!message.guild) return;
  const guildId = message.guild.id;
  const key = `${guildId}:${userId}`;

  const warns = warnMap.get(key) ?? [];
  warns.push({ reason, by: "AUTO", at: Date.now() });
  warnMap.set(key, warns);

  const warnCount = warns.length;

  // Public warning
  try {
    const warnEmbed = new EmbedBuilder()
      .setColor(warnCount >= WARN_MUTE_AT ? 0xED4245 : 0xFEE75C)
      .setDescription(`${publicMsg}\n\n> ⚠️ **Avertissement ${warnCount}/${WARN_MUTE_AT}**`);
    await (message.channel as TextChannel).send({ embeds: [warnEmbed] });
  } catch {}

  // Auto-mute at threshold
  if (warnCount >= WARN_MUTE_AT) {
    warnMap.set(key, []); // reset warns
    try {
      const member = await message.guild.members.fetch(userId);
      await member.timeout(MUTE_DURATION_MS, `${WARN_MUTE_AT} avertissements — ${reason}`);
      await (message.channel as TextChannel).send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(`🔇 <@${userId}> a été **mis en sourdine pendant 10 minutes** après ${WARN_MUTE_AT} avertissements.`),
        ],
      });
    } catch {}
  }

  // Log
  await sendLog(
    message.guild,
    new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({ name: `⚠️  Avertissement Automatique` })
      .addFields(
        { name: "👤  Utilisateur", value: `<@${userId}>`,   inline: true },
        { name: "⚠️  Warn",        value: `${warnCount}/${WARN_MUTE_AT}`, inline: true },
        { name: "📝  Raison",      value: reason,            inline: false },
      )
      .setTimestamp(),
  );
}

// ─── Manual Warn (staff command) ─────────────────────────────────────────────
export function addWarn(guildId: string, userId: string, reason: string, by: string) {
  const key = `${guildId}:${userId}`;
  const warns = warnMap.get(key) ?? [];
  warns.push({ reason, by, at: Date.now() });
  warnMap.set(key, warns);
  return warns.length;
}

export function getWarns(guildId: string, userId: string) {
  return warnMap.get(`${guildId}:${userId}`) ?? [];
}

export function clearWarns(guildId: string, userId: string) {
  warnMap.delete(`${guildId}:${userId}`);
}
