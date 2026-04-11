import type { Client } from 'discord.js';
import type { Hoshimi } from 'hoshimi';

// ---------------------------------------------------------------------------
// Client Singleton
//
// The API's player route needs access to the Discord Client instance to fetch
// channels and guild info for the auto-join feature. This module provides a
// simple getter/setter so the client created in startBot() can be accessed
// from the API package.
//
// The client is set once during bot startup and remains available for the
// lifetime of the process.
// ---------------------------------------------------------------------------

let _client: Client | null = null;
let _hoshimi: Hoshimi | null = null;

/**
 * Store the Discord client reference.
 * Called once during bot startup in packages/bot/src/index.ts.
 */
export function setClient(client: Client): void {
  _client = client;
}

/**
 * Retrieve the Discord client instance.
 * Returns null if the bot hasn't started yet.
 */
export function getClient(): Client | null {
  return _client;
}

/**
 * Store the Hoshimi manager reference.
 * Called once during bot startup in packages/bot/src/index.ts.
 */
export function setHoshimi(hoshimi: Hoshimi): void {
  _hoshimi = hoshimi;
}

/**
 * Retrieve the Hoshimi manager instance.
 * Returns null if the bot hasn't started yet.
 */
export function getHoshimi(): Hoshimi | null {
  return _hoshimi;
}

/**
 * @deprecated Use getHoshimi() instead. This alias is here for backwards
 * compatibility while migrating from @discordjs/voice.
 */
export function getNodeManager(): Hoshimi | null {
  return _hoshimi;
}
