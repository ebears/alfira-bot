import type { VoiceConnection } from '@discordjs/voice';
import { getVoiceConnection } from '@discordjs/voice';
import {
  ChannelType,
  type Client,
  type TextChannel,
  type VoiceChannel,
  type VoiceState,
} from 'discord.js';
import { GuildPlayer } from './GuildPlayer';

// ---------------------------------------------------------------------------
// PlayerManager
//
// A simple Map that holds one GuildPlayer per guild for the lifetime of a
// voice session. Commands import getPlayer() and createPlayer() from here
// rather than managing the Map themselves.
//
// This module is intentionally stateless beyond the Map — no classes, no
// singletons. It's just a shared store with a small helper API.
// ---------------------------------------------------------------------------

const players = new Map<string, GuildPlayer>();

/**
 * Retrieve the active GuildPlayer for a guild, or undefined if none exists.
 */
export function getPlayer(guildId: string): GuildPlayer | undefined {
  return players.get(guildId);
}

/**
 * Create a new GuildPlayer for a guild and store it.
 * If a player already exists for this guild it is returned as-is rather than
 * being replaced, to avoid accidentally discarding an active queue.
 *
 * The GuildPlayer receives an onDestroyed callback so it can remove itself
 * from the Map when the voice connection is torn down — whether that happens
 * intentionally (stop/leave commands) or unexpectedly (network drop, bot
 * kicked). This avoids a circular import between GuildPlayer and this module.
 */
export function createPlayer(
  guildId: string,
  connection: VoiceConnection,
  textChannel: TextChannel
): GuildPlayer {
  const existing = players.get(guildId);
  if (existing) return existing;

  const player = new GuildPlayer(connection, textChannel, guildId, () => {
    players.delete(guildId);
  });

  players.set(guildId, player);
  return player;
}

/**
 * Stop all active players and destroy their voice connections.
 * Used during graceful shutdown to clean up FFmpeg processes and voice connections.
 */
export function destroyAllPlayers(): void {
  for (const [guildId, player] of players) {
    player.stop();
    const connection = getVoiceConnection(guildId);
    if (connection) connection.destroy();
  }
  players.clear();
}

/**
 * Register a voiceStateUpdate listener that pauses playback when all humans
 * leave the channel and resumes when a human returns.
 */
export function initVoiceIdleMonitor(client: Client): void {
  client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild.id || oldState.guild.id;
    const player = getPlayer(guildId);
    if (!player) return;

    const connection = getVoiceConnection(guildId);
    if (!connection) return;
    const botChannelId = connection.joinConfig.channelId;
    if (!botChannelId) return;

    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const wasInBotChannel = oldState.channelId === botChannelId;
    const isInBotChannel = newState.channelId === botChannelId;

    if (wasInBotChannel && !isInBotChannel) {
      const botChannel = newState.guild.channels.cache.get(botChannelId);
      if (!botChannel || botChannel.type !== ChannelType.GuildVoice) return;
      const vc = botChannel as VoiceChannel;
      const humansInChannel = vc.members.filter((m) => !m.user.bot).size;
      if (humansInChannel === 0) {
        player.onEveryoneLeftChannel();
      }
    } else if (!wasInBotChannel && isInBotChannel) {
      player.onHumanJoinedChannel();
    }
  });
}
