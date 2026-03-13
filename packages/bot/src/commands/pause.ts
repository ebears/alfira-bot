import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { requireGuild, requirePlaying } from './guards';

export const pauseCommand: Command = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause or resume playback.'),

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const player = await requirePlaying(interaction, guild.id);
    if (!player) return;

    const isPaused = player.togglePause();
    await interaction.reply(isPaused ? '⏸️ Paused.' : '▶️ Resumed.');
  },
};
