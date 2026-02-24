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
 */
export function createPlayer(
  guildId: string,
  connection: VoiceConnection,
  textChannel: TextChannel
): GuildPlayer {
  const existing = players.get(guildId);
  if (existing) return existing;

  const player = new GuildPlayer(connection, textChannel);
  players.set(guildId, player);
  return player;
}

/**
 * Remove the GuildPlayer for a guild.
 * Call this after GuildPlayer.stop() so the Map doesn't hold stale instances.
 */
export function removePlayer(guildId: string): void {
  players.delete(guildId);
}