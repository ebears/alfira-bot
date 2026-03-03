import { Client, GatewayIntentBits, Collection, Interaction, InteractionReplyOptions, REST, Routes } from 'discord.js';
import { setClient } from './lib/client';
import { joinCommand } from './commands/join';
import { leaveCommand } from './commands/leave';
import { playCommand } from './commands/play';
import { skipCommand } from './commands/skip';
import { stopCommand } from './commands/stop';
import { pauseCommand } from './commands/pause';
import { loopCommand } from './commands/loop';
import { shuffleCommand } from './commands/shuffle';
import { queueCommand } from './commands/queue';
import { nowplayingCommand } from './commands/nowplaying';
import { playlistCommand } from './commands/playlist';
import type { Command } from './types';

// ---------------------------------------------------------------------------
// deployCommands
//
// Registers slash commands with Discord. Called automatically on startup when
// AUTO_DEPLOY_COMMANDS is enabled (default: true in production).
// ---------------------------------------------------------------------------
async function deployCommands(clientId: string, guildId: string, token: string, commands: Command[]): Promise<void> {
  const rest = new REST().setToken(token);
  const commandData = commands.map((c) => c.data.toJSON());

  try {
    console.log(`🔄 Auto-registering ${commandData.length} slash command(s)...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commandData }
    );
    console.log('✅ Slash commands registered successfully.');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    // Don't throw - the bot can still function, commands just won't work until deployed
  }
}

// ---------------------------------------------------------------------------
// startBot
//
// Initialises and connects the Discord bot. Called by the API's entry point
// (packages/api/src/index.ts) after Express and Prisma are ready.
//
// The bot no longer runs itself — the API process owns startup. This allows
// the bot and API to share a process, which is required for GuildPlayer to
// call broadcastQueueUpdate() directly on the Socket.io server (Phase 8).
//
// Note: dotenv is NOT called here. The API entry point loads env vars before
// calling startBot(), so they are already on process.env by the time this runs.
// ---------------------------------------------------------------------------
export async function startBot(): Promise<void> {
  const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID, AUTO_DEPLOY_COMMANDS } = process.env;

  // Validate required environment variables
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
  		intents: [
  			GatewayIntentBits.Guilds,
  			GatewayIntentBits.GuildVoiceStates,
  		],
  	});

  	// Expose the client so the API can access it for auto-join functionality.
  	setClient(client);

  client.commands = new Collection<string, Command>();

  const commands: Command[] = [
    joinCommand,
    leaveCommand,
    playCommand,
    skipCommand,
    stopCommand,
    pauseCommand,
    loopCommand,
    shuffleCommand,
    queueCommand,
    nowplayingCommand,
    playlistCommand,
  ];

  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }

  client.once('clientReady', async (readyClient) => {
    console.log(`✅ Bot logged in as ${readyClient.user.tag}`);

    // Auto-deploy commands if enabled (default: true for convenience)
    // Set AUTO_DEPLOY_COMMANDS=false to disable (e.g., for advanced use cases)
    const shouldAutoDeploy = AUTO_DEPLOY_COMMANDS !== 'false';
    if (shouldAutoDeploy) {
      await deployCommands(DISCORD_CLIENT_ID!, GUILD_ID!, DISCORD_BOT_TOKEN!, commands);
    } else {
      console.log('ℹ️  Auto-deploy disabled (AUTO_DEPLOY_COMMANDS=false). Run `npm run bot:deploy` manually if needed.');
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(`⚠️  No handler found for command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌  Error executing /${interaction.commandName}:`, error);

      const errorMessage: InteractionReplyOptions = { content: 'Something went wrong.', flags: 'Ephemeral' };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  });

  await client.login(DISCORD_BOT_TOKEN);
}
