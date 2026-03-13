import type { ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';
import { ChannelType } from 'discord.js';
import type { GuildPlayer } from '../player/GuildPlayer';
import { getPlayer } from '../player/manager';

/**
 * Guard: ensures the command was used inside a guild.
 * Replies with an ephemeral error and returns null if not.
 * Returns the guild on success so callers can use it without non-null assertions.
 */
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

/**
 * Guard: ensures the user is in a voice channel.
 * Replies with an ephemeral error and returns null if not.
 * Returns the GuildMember's voice channel on success.
 */
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

/**
 * Guard: ensures a player exists and something is currently playing.
 * Replies with an ephemeral error and returns null if not.
 * Returns the player on success.
 */
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
