import { SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { getPlayer, removePlayer } from '../player/manager';
import type { Command } from '../types';

export const leaveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Stop playback, clear the queue, and leave the voice channel.'),

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

    // Stop the GuildPlayer first (clears queue, broadcasts idle state, kills FFmpeg).
    const player = getPlayer(interaction.guild.id);
    if (player) {
      player.stop();
    }

    // Destroy the voice connection. The GuildPlayer's Destroyed handler will
    // call onDestroyed() and remove it from the manager.
    connection.destroy();

    // Belt-and-suspenders: remove from manager in case the Destroyed handler
    // has already been unregistered or hasn't fired yet.
    removePlayer(interaction.guild.id);

    await interaction.reply('👋 Stopped playback and left the voice channel.');
  },
};
