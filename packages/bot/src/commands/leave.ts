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
    // Stop the GuildPlayer first (clears the queue and stops the AudioPlayer),
    // then remove it from the manager so the next /play starts fresh.
    //
    // GuildPlayer.stop() also calls connection.destroy() internally, so we
    // don't need to call it separately here.
    // ---------------------------------------------------------------------------
    const player = getPlayer(interaction.guild.id);
    if (player) {
      // stop() clears the queue, stops the AudioPlayer, and destroys the
      // voice connection. The Destroyed event handler inside GuildPlayer calls
      // onDestroyed(), which removes it from the manager automatically.
      player.stop();
    } else {
      // Bot is in a channel but no player exists (e.g. joined via /join without
      // playing anything). Destroy the connection directly.
      connection.destroy();
    }

    await interaction.reply('👋 Left the voice channel.');
  },
};
