import type { LoopMode, QueuedSong } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import { EmbedBuilder } from 'discord.js';

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const LOOP_MODE_LABELS: Record<LoopMode, string> = {
  off: '⬛ Off',
  song: '🔂 Song',
  queue: '🔁 Queue',
};

export const LOOP_MODE_DESCRIPTIONS: Record<LoopMode, string> = {
  off: 'off',
  song: 'the current song',
  queue: 'the entire queue',
};

export function formatLoopMode(mode: LoopMode): string {
  return LOOP_MODE_LABELS[mode];
}

export function buildNowPlayingEmbed(song: QueuedSong, loopMode: LoopMode): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('▶️  Now Playing')
    .setDescription(`**[${song.title}](${song.youtubeUrl})**`)
    .setThumbnail(song.thumbnailUrl)
    .addFields(
      { name: 'Duration', value: formatDuration(song.duration), inline: true },
      { name: 'Requested by', value: song.requestedBy, inline: true },
      { name: 'Loop', value: formatLoopMode(loopMode), inline: true }
    );
}
