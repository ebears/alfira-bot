import { logger } from '@alfira-bot/shared/logger';
import { getVoiceConnection } from '@discordjs/voice';
import { Client, GatewayIntentBits } from 'discord.js';
import { setClient } from './lib/client';
import { getPlayer } from './player/manager';

// ---------------------------------------------------------------------------
// Public API re-exports
//
// These are the symbols the API package needs from the bot. By re-exporting
// them here, consumers import from '@alfira-bot/bot' instead of reaching
// into internal paths like '@alfira-bot/bot/src/lib/client'.
// ---------------------------------------------------------------------------

// Broadcast indirection (API injects emit function at boot)
export { broadcastQueueUpdate, setBroadcastQueueUpdate } from './lib/broadcast';

// Discord client singleton
export { getClient } from './lib/client';

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
} from './utils/ytdlp';

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

  client.once('clientReady', (readyClient) => {
    logger.info(`Bot logged in as ${readyClient.user.tag}`);
  });

  client.on('voiceStateUpdate', (oldState, newState) => {
    // Ignore the bot's own voice changes.
    if (newState.member?.user.bot && oldState.member?.user.bot) return;

    const guildId = oldState.guild.id;
    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    const connectionChannelId = connection.joinConfig.channelId;
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
      const player = getPlayer(guildId);
      if (player?.getCurrentSong() && player.isPlaying()) {
        player.togglePause();
        logger.info({ guildId }, "Auto-paused: no humans left in the bot's voice channel.");
      }
    }
  });

  await client.login(DISCORD_BOT_TOKEN);
}
