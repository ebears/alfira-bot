import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { VOICE_CONNECTION_TIMEOUT_MS } from '@alfira-bot/shared';
import type { ChatInputCommandInteraction, Guild, GuildMember, TextChannel } from 'discord.js';
import { ChannelType, type SlashCommandBuilder } from 'discord.js';
import type { GuildPlayer } from '../player/GuildPlayer';
import { createPlayer, getPlayer } from '../player/manager';
import type { Command } from '../types';

export async function requireGuild(
  interaction: ChatInputCommandInteraction
): Promise<Guild | null> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used inside a server.',
      flags: 'Ephemeral',
    });
    return null;
  }
  return interaction.guild;
}

export async function requireVoiceChannel(
  interaction: ChatInputCommandInteraction
): Promise<NonNullable<GuildMember['voice']['channel']> | null> {
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (
    !voiceChannel ||
    (voiceChannel.type !== ChannelType.GuildVoice &&
      voiceChannel.type !== ChannelType.GuildStageVoice)
  ) {
    await interaction.reply({
      content: 'You need to be in a voice channel to use this command.',
      flags: 'Ephemeral',
    });
    return null;
  }

  return voiceChannel;
}

export async function requirePlaying(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<GuildPlayer | null> {
  const player = getPlayer(guildId);

  if (!player || !player.getCurrentSong()) {
    await interaction.reply({ content: 'Nothing is currently playing.', flags: 'Ephemeral' });
    return null;
  }

  return player;
}

/**
 * Gets an existing voice connection or joins the user's channel, then returns
 * the GuildPlayer (creating one if needed). Replies with an error and returns
 * null if the connection cannot be established.
 */
export async function getOrCreateConnection(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  voiceChannel: NonNullable<GuildMember['voice']['channel']>
): Promise<GuildPlayer | null> {
  const guildId = guild.id;
  let connection = getVoiceConnection(guildId);

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: guild.voiceAdapterCreator,
    });
  }

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, VOICE_CONNECTION_TIMEOUT_MS);
  } catch {
    connection.destroy();
    await interaction.editReply('❌ Could not connect to the voice channel in time. Try again.');
    return null;
  }

  return createPlayer(guildId, connection, interaction.channel as TextChannel);
}

/**
 * Creates a Command that requires an active guild + playing player before
 * delegating to `handler`.  Absorbs the repeated requireGuild / requirePlaying
 * boilerplate from skip, pause, etc.
 */
export function requirePlayingCommand(
  data: SlashCommandBuilder,
  handler: (interaction: ChatInputCommandInteraction, player: GuildPlayer) => Promise<void>
): Command {
  return {
    data,
    async execute(interaction) {
      const guild = await requireGuild(interaction);
      if (!guild) return;

      const player = await requirePlaying(interaction, guild.id);
      if (!player) return;

      await handler(interaction, player);
    },
  };
}
