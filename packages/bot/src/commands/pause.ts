import { SlashCommandBuilder } from 'discord.js';
import { requirePlayingVoiceCommand } from './guards';

export const pauseCommand = requirePlayingVoiceCommand(
  new SlashCommandBuilder().setName('pause').setDescription('Pause or resume playback.'),
  async (interaction, player) => {
    const isPaused = player.togglePause();
    await interaction.reply(isPaused ? '⏸️ Paused.' : '▶️ Resumed.');
  }
);
