import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';

export const pauseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause or resume playback.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', flags: 'Ephemeral' });
      return;
    }

    const player = getPlayer(interaction.guild.id);

    if (!player || !player.getCurrentSong()) {
      await interaction.reply({ content: 'Nothing is currently playing.', flags: 'Ephemeral' });
      return;
    }

    const isPaused = player.togglePause();
    await interaction.reply(isPaused ? '⏸️ Paused.' : '▶️ Resumed.');
  },
};
