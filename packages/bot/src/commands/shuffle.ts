import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';

export const shuffleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the upcoming queue. Does not affect the current song.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', flags: 'Ephemeral' });
      return;
    }

    const player = getPlayer(interaction.guild.id);
    const queue = player?.getQueue() ?? [];

    if (!player || queue.length === 0) {
      await interaction.reply({ content: 'There are no queued songs to shuffle.', flags: 'Ephemeral' });
      return;
    }

    player.shuffle();

    await interaction.reply(`🔀 Shuffled ${queue.length} song${queue.length === 1 ? '' : 's'} in the queue.`);
  },
};
