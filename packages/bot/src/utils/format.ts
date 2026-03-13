import type { LoopMode, QueuedSong } from '@alfira-bot/shared';
import { EmbedBuilder } from 'discord.js';

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// The /loop command uses its own longer confirmation strings — not shared here.
export function formatLoopMode(mode: LoopMode): string {
  const labels: Record<LoopMode, string> = {
    off: '⬛ Off',
    song: '🔂 Song',
    queue: '🔁 Queue',
  };
  return labels[mode];
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
