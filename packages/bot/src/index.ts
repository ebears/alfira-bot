import { logger } from '@alfira-bot/shared/logger';
import { Client, GatewayIntentBits } from 'discord.js';
import { getHoshimi, setClient, setHoshimi } from './lib/client';
import { getPlayer } from './player/manager';

// ---------------------------------------------------------------------------
// Public API re-exports
//
// These are the symbols the API package needs from the bot. By re-exporting
// them here, consumers import from '@alfira-bot/bot' instead of reaching
// into internal paths like '@alfira-bot/bot/src/lib/client'.
// ---------------------------------------------------------------------------

// Hoshimi types re-exported for API package
export type { DestroyReasons } from 'hoshimi';
// Broadcast indirection (API injects emit function at boot)
export { broadcastQueueUpdate, setBroadcastQueueUpdate } from './lib/broadcast';
// Discord client singleton
// Hoshimi manager (for API package to access player state)
export { getClient, getHoshimi } from './lib/client';
// Constants
export { VOICE_CONNECTION_TIMEOUT_MS } from './lib/constants';
export type { GuildPlayer } from './player/GuildPlayer';
// Player manager (guild-level player lifecycle)
export { createPlayer, destroyAllPlayers, getPlayer } from './player/manager';
// YouTube utilities (URL validation, metadata fetching)
export {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
  type PlaylistMetadata,
} from './utils/nodelink';

const NODELINK_URL = process.env.NODELINK_URL ?? 'http://localhost:2333';
const NODELINK_AUTH = process.env.NODELINK_AUTHORIZATION ?? '';

function parseNodeLinkUrl(url: string): { host: string; port: number; secure: boolean } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 2333),
    secure: parsed.protocol === 'https:',
  };
}

/** Initializes and connects the Discord bot. Called by the API entry point. */
export async function startBot(): Promise<void> {
  const { DISCORD_BOT_TOKEN } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is not set.');
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  setClient(client);

  // Initialize Hoshimi manager for audio.
  const { Hoshimi } = await import('hoshimi');
  const nodeConfig = parseNodeLinkUrl(NODELINK_URL);

  const hoshimi = new Hoshimi({
    sendPayload: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      guild.shard.send(payload);
    },
    nodes: [
      {
        host: nodeConfig.host,
        port: nodeConfig.port,
        password: NODELINK_AUTH,
        secure: nodeConfig.secure,
      },
    ],
    client: {
      id: '',
      username: '',
    },
  });

  client.once('ready', (readyClient) => {
    hoshimi.init({ id: readyClient.user.id, username: readyClient.user.username });
    logger.info(`Bot logged in as ${readyClient.user.tag}`);
  });

  setHoshimi(hoshimi);

  // Forward all raw gateway packets to hoshimi so it can handle voice server updates.
  // This is required for NodeLink to receive Discord's voice connection details.
  client.on('raw', (packet) => {
    hoshimi.updateVoiceState(packet);
  });

  client.on('voiceStateUpdate', (oldState, newState) => {
    // Ignore the bot's own voice changes.
    if (newState.member?.user.bot && oldState.member?.user.bot) return;

    const guildId = oldState.guild.id;
    const manager = getHoshimi();
    if (!manager) return;

    // Get the player's voice channel for this guild.
    const player = manager.players.get(guildId);
    if (!player) return;

    const connectionChannelId = player.voiceId;
    if (!connectionChannelId) return;

    // Only act when a user left the bot's voice channel.
    const leftBotChannel = oldState.channelId === connectionChannelId;
    const joinedBotChannel = newState.channelId === connectionChannelId;
    if (!leftBotChannel || joinedBotChannel) return;

    // Count remaining non-bot members in the bot's voice channel.
    const voiceChannel = oldState.channel;
    if (!voiceChannel) return;

    const humanCount = voiceChannel.members.filter((m) => !m.user.bot).size;

    if (humanCount === 0) {
      const guildPlayer = getPlayer(guildId);
      if (guildPlayer?.getCurrentSong() && guildPlayer.isPlaying()) {
        guildPlayer.togglePause();
        logger.info({ guildId }, "Auto-paused: no humans left in the bot's voice channel.");
      }
    }
  });

  await client.login(DISCORD_BOT_TOKEN);
}
