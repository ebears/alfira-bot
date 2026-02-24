import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';

export const skipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', flags: 'Ephemeral' });
      return;
    }

    const player = getPlayer(interaction.guild.id);

    if (!player || !player.isPlaying()) {
      await interaction.reply({ content: 'Nothing is currently playing.', flags: 'Ephemeral' });
      return;
    }

    const current = player.getCurrentSong();
    await player.skip();

    const next = player.getCurrentSong();

    if (next) {
      await interaction.reply(`⏭️ Skipped **${current?.title}**.`);
    } else {
      await interaction.reply(`⏭️ Skipped **${current?.title}**. The queue is now empty.`);
    }
  },
};
