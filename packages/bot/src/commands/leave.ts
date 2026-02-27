import { SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';

export const leaveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Stop playback and leave the voice channel.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: 'Ephemeral',
      });
      return;
    }

    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      await interaction.reply({
        content: "I'm not in a voice channel.",
        flags: 'Ephemeral',
      });
      return;
    }

    // ---------------------------------------------------------------------------
    // Clear the GuildPlayer first (stops the AudioPlayer, clears the queue,
    // and destroys the voice connection), then remove it from the manager so
    // the next /play starts fresh.
    // ---------------------------------------------------------------------------
    const player = getPlayer(interaction.guild.id);
    if (player) {
      player.clearQueue();
    }
    connection.destroy();

    await interaction.reply('👋 Left the voice channel.');
  },
};
