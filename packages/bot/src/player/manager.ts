import { VoiceConnection } from '@discordjs/voice';
import { TextChannel } from 'discord.js';
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
  textChannel: TextChannel,
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
 * Remove the GuildPlayer for a guild.
 * Call this after GuildPlayer.stop() so the Map doesn't hold stale instances.
 * Safe to call even if the player has already removed itself via onDestroyed.
 */
export function removePlayer(guildId: string): void {
  players.delete(guildId);
}
