import { getVoiceConnection } from '@discordjs/voice';
import { SlashCommandBuilder } from 'discord.js';
import { getPlayer, removePlayer } from '../player/manager';
import type { Command } from '../types';
import { requireGuild } from './guards';

export const leaveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Stop playback, clear the queue, and leave the voice channel.'),

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const guildId = guild.id;
    const connection = getVoiceConnection(guildId);

    if (!connection) {
      await interaction.reply({
        content: "I'm not in a voice channel.",
        flags: 'Ephemeral',
      });
      return;
    }

    // Stop the GuildPlayer first (clears queue, broadcasts idle state, kills FFmpeg).
    const player = getPlayer(guildId);
    if (player) {
      player.stop();
    }

    // Destroy the voice connection. The GuildPlayer's Destroyed handler will
    // call onDestroyed() and remove it from the manager.
    connection.destroy();

    // Belt-and-suspenders: remove from manager in case the Destroyed handler
    // has already been unregistered or hasn't fired yet.
    removePlayer(guildId);

    await interaction.reply('👋 Stopped playback and left the voice channel.');
  },
};
