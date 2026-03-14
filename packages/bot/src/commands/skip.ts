import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { requireGuild, requirePlaying } from './guards';

export const skipCommand: Command = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song.'),

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const player = await requirePlaying(interaction, guild.id);
    if (!player) return;

    const currentTitle = player.getCurrentSong()?.title;
    player.skip();

    if (player.getCurrentSong()) {
      await interaction.reply(`⏭️ Skipped **${currentTitle}**.`);
    } else {
      await interaction.reply(`⏭️ Skipped **${currentTitle}**. The queue is now empty.`);
    }
  },
};
