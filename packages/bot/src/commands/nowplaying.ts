import { formatDuration } from '@alfira-bot/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../player/manager';
import type { Command } from '../types';
import { EMBED_COLOR, formatLoopMode, pluralize } from '../utils/format';
import { requireGuild } from './guards';

export const nowplayingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show what is currently playing.'),

  async execute(interaction) {
    const guild = await requireGuild(interaction);
    if (!guild) return;

    const player = getPlayer(guild.id);
    const song = player?.getCurrentSong() ?? null;

    if (!song) {
      await interaction.reply({ content: 'Nothing is currently playing.', flags: 'Ephemeral' });
      return;
    }

    const loopMode = player?.getLoopMode() ?? 'off';
    const queueLength = player?.getQueue().length ?? 0;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('▶️  Now Playing')
      .setDescription(`**[${song.title}](${song.youtubeUrl})**`)
      .setThumbnail(song.thumbnailUrl)
      .addFields(
        { name: 'Duration', value: formatDuration(song.duration), inline: true },
        { name: 'Requested by', value: song.requestedBy, inline: true },
        { name: 'Loop', value: formatLoopMode(loopMode), inline: true }
      )
      .setFooter({
        text: queueLength > 0 ? `${pluralize(queueLength, 'song')} in queue` : 'No songs in queue',
      });

    await interaction.reply({ embeds: [embed] });
  },
};
