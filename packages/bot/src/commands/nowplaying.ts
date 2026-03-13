import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';
import { buildNowPlayingEmbed } from '../utils/format';

export const nowplayingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show what is currently playing.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: 'Ephemeral',
      });
      return;
    }

    const player = getPlayer(interaction.guild.id);
    const song = player?.getCurrentSong() ?? null;

    if (!song) {
      await interaction.reply({ content: 'Nothing is currently playing.', flags: 'Ephemeral' });
      return;
    }

    const loopMode = player?.getLoopMode() ?? 'off';
    const queueLength = player?.getQueue().length ?? 0;

    const embed = buildNowPlayingEmbed(song, loopMode).setFooter({
      text:
        queueLength > 0
          ? `${queueLength} song${queueLength === 1 ? '' : 's'} in queue`
          : 'No songs in queue',
    });

    await interaction.reply({ embeds: [embed] });
  },
};
