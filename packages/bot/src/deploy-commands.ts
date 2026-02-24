/**
 * deploy-commands.ts
 *
 * Run this script once (and again any time you add, remove, or change a
 * command's definition) to register your slash commands with Discord.
 *
 * Usage:
 *   npm run bot:deploy
 *
 * Commands are registered as GUILD commands (scoped to your specific server)
 * rather than global commands. Guild commands update instantly, whereas global
 * commands can take up to an hour to propagate. Always use guild commands
 * during development.
 */

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { joinCommand } from './commands/join';
import { leaveCommand } from './commands/leave';
import { playCommand } from './commands/play';
import { skipCommand } from './commands/skip';
import { stopCommand } from './commands/stop';
import { loopCommand } from './commands/loop';
import { shuffleCommand } from './commands/shuffle';
import { queueCommand } from './commands/queue';
import { nowplayingCommand } from './commands/nowplaying';

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID) {
  console.error(
    '❌  Missing one or more required env vars: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID'
  );
  process.exit(1);
}

const commands = [
  joinCommand,
  leaveCommand,
  playCommand,
  skipCommand,
  stopCommand,
  loopCommand,
  shuffleCommand,
  queueCommand,
  nowplayingCommand,
].map((c) => c.data.toJSON());

const rest = new REST().setToken(DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log(`🔄  Registering ${commands.length} slash command(s)...`);

    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('✅  Slash commands registered successfully.');
  } catch (error) {
    console.error('❌  Failed to register commands:', error);
    process.exit(1);
  }
})();
