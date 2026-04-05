import { SlashCommandBuilder } from 'discord.js';
import { requirePlayingVoiceCommand } from './guards';

export const skipCommand = requirePlayingVoiceCommand(
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song.'),
  async (interaction, player) => {
    const currentTitle = player.getCurrentSong()?.title;
    player.skip();

    const suffix = player.getCurrentSong() ? '' : ' The queue is now empty.';
    await interaction.reply(`⏭️ Skipped **${currentTitle}**.${suffix}`);
  }
);
