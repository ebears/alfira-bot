import { SlashCommandBuilder } from 'discord.js';
import { leaveCommand } from './leave';
import type { Command } from '../types';

// ---------------------------------------------------------------------------
// /stop is an alias for /leave.
//
// Both commands stop playback, clear the queue, and disconnect the bot from
// the voice channel. /stop is kept so existing muscle-memory still works.
// ---------------------------------------------------------------------------
export const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear the queue, and leave the voice channel.'),

  execute: leaveCommand.execute,
};
