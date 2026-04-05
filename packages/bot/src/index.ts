import { logger } from '@alfira-bot/shared';
import { getVoiceConnection } from '@discordjs/voice';
import {
  Client,
  Collection,
  GatewayIntentBits,
  type Interaction,
  type InteractionReplyOptions,
  REST,
  Routes,
} from 'discord.js';
import { commands } from './commands';
import { setClient } from './lib/client';
import { getPlayer } from './player/manager';
import type { Command } from './types';

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
export { GuildPlayer } from './player/GuildPlayer';
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

export async function deployCommands(
  clientId: string,
  guildId: string,
  token: string,
  commands: Command[]
): Promise<void> {
  const rest = new REST().setToken(token);
  const commandData = commands.map((c) => c.data.toJSON());

  try {
    logger.info(`Auto-registering ${commandData.length} slash command(s)...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
    logger.info('Slash commands registered successfully.');
  } catch (error) {
    logger.error(error, 'Failed to register commands');
    // Don't throw - the bot can still function, commands just won't work until deployed
  }
}

/** Initializes and connects the Discord bot. Called by the API entry point. */
export async function startBot(): Promise<void> {
  const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID, AUTO_DEPLOY_COMMANDS } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is not set.');
  }
  if (!DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_CLIENT_ID is not set.');
  }
  if (!GUILD_ID) {
    throw new Error('GUILD_ID is not set.');
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  setClient(client);

  client.commands = new Collection<string, Command>();

  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }

  client.once('clientReady', async (readyClient) => {
    logger.info(`Bot logged in as ${readyClient.user.tag}`);

    const shouldAutoDeploy = AUTO_DEPLOY_COMMANDS !== 'false';
    if (shouldAutoDeploy) {
      await deployCommands(DISCORD_CLIENT_ID, GUILD_ID, DISCORD_BOT_TOKEN, commands);
    } else {
      logger.info(
        'Auto-deploy disabled (AUTO_DEPLOY_COMMANDS=false). Run `npm run bot:deploy` manually if needed.'
      );
    }
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

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`No handler found for command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(error, `Error executing /${interaction.commandName}`);

      const errorMessage: InteractionReplyOptions = {
        content: 'Something went wrong.',
        flags: 'Ephemeral',
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  });

  await client.login(DISCORD_BOT_TOKEN);
}
