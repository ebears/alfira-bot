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
import { commands } from './commands';

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID) {
  console.error(
    '❌  Missing one or more required env vars: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID'
  );
  process.exit(1);
}

const commandData = commands.map((c) => c.data.toJSON());

const rest = new REST().setToken(DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log(`🔄  Registering ${commandData.length} slash command(s)...`);

    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), {
      body: commandData,
    });

    console.log('✅  Slash commands registered successfully.');
  } catch (error) {
    console.error('❌  Failed to register commands:', error);
    process.exit(1);
  }
})();
