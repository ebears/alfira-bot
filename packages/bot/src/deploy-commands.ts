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
import { logger } from '@alfira-bot/shared';
import { commands } from './commands';
import { deployCommands } from './index';

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID) {
  logger.error(
    'Missing one or more required env vars: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, GUILD_ID'
  );
  process.exit(1);
} else {
  (async () => {
    await deployCommands(DISCORD_CLIENT_ID, GUILD_ID, DISCORD_BOT_TOKEN, commands);
  })();
}
