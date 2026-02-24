import { SlashCommandBuilder } from 'discord.js';
import { getPlayer, removePlayer } from '../player/manager';
import type { Command } from '../types';

export const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear the queue, and leave the voice channel.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', flags: 'Ephemeral' });
      return;
    }

    const player = getPlayer(interaction.guild.id);

    if (!player) {
      await interaction.reply({ content: "I'm not playing anything.", flags: 'Ephemeral' });
      return;
    }

    // stop() clears the queue, stops the AudioPlayer, and destroys the
    // voice connection. Remove it from the manager so the next /play
    // creates a fresh player.
    player.stop();
    removePlayer(interaction.guild.id);

    await interaction.reply('⏹️ Stopped playback and cleared the queue.');
  },
};
