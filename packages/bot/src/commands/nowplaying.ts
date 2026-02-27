import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import { formatDuration, formatLoopMode } from '../utils/format';
import type { Command } from '../types';

export const nowplayingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show what is currently playing.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', flags: 'Ephemeral' });
      return;
    }

    const player = getPlayer(interaction.guild.id);
    const song = player?.getCurrentSong() ?? null;

    if (!song) {
      await interaction.reply({ content: 'Nothing is currently playing.', flags: 'Ephemeral' });
      return;
    }

    const loopMode = player!.getLoopMode();
    const queueLength = player!.getQueue().length;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('▶️  Now Playing')
      .setDescription(`**[${song.title}](${song.youtubeUrl})**`)
      .setThumbnail(song.thumbnailUrl)
      .addFields(
        { name: 'Duration', value: formatDuration(song.duration), inline: true },
        { name: 'Requested by', value: song.requestedBy, inline: true },
        { name: 'Loop', value: formatLoopMode(loopMode), inline: true }
      )
      .setFooter({
        text: queueLength > 0
          ? `${queueLength} song${queueLength === 1 ? '' : 's'} in queue`
          : 'No songs in queue',
      });

    await interaction.reply({ embeds: [embed] });
  },
};
