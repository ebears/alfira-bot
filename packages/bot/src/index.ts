import { Client, GatewayIntentBits, Collection, Interaction, InteractionReplyOptions } from 'discord.js';
import { joinCommand } from './commands/join';
import { leaveCommand } from './commands/leave';
import { playCommand } from './commands/play';
import { skipCommand } from './commands/skip';
import { stopCommand } from './commands/stop';
import { loopCommand } from './commands/loop';
import { shuffleCommand } from './commands/shuffle';
import { queueCommand } from './commands/queue';
import { nowplayingCommand } from './commands/nowplaying';
import type { Command } from './types';

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
  const { DISCORD_BOT_TOKEN } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is not set.');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.commands = new Collection<string, Command>();

  const commands: Command[] = [
    joinCommand,
    leaveCommand,
    playCommand,
    skipCommand,
    stopCommand,
    loopCommand,
    shuffleCommand,
    queueCommand,
    nowplayingCommand,
  ];

  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }

  client.once('clientReady', (readyClient) => {
    console.log(`✅  Bot logged in as ${readyClient.user.tag}`);
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
