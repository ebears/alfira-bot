import type { LoopMode, QueuedSong } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared/src/format';
import { EmbedBuilder } from 'discord.js';

export { formatDuration };

// ---------------------------------------------------------------------------
// formatLoopMode
//
// Returns the short display label for a loop mode.
// Used in "Now Playing" embeds, queue footers, and the /nowplaying command.
//
// Note: the /loop command uses its own longer confirmation strings — those
// are local to that command and intentionally not shared here.
// ---------------------------------------------------------------------------
export function formatLoopMode(mode: LoopMode): string {
  const labels: Record<LoopMode, string> = {
    off: '⬛ Off',
    song: '🔂 Song',
    queue: '🔁 Queue',
  };
  return labels[mode];
}

// ---------------------------------------------------------------------------
// buildNowPlayingEmbed
//
// Builds a "Now Playing" embed for the given song.
// Used by GuildPlayer for auto-advance announcements and the /nowplaying command.
// ---------------------------------------------------------------------------
export function buildNowPlayingEmbed(song: QueuedSong, loopMode: LoopMode): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2) // Discord blurple
    .setTitle('▶️  Now Playing')
    .setDescription(`**[${song.title}](${song.youtubeUrl})**`)
    .setThumbnail(song.thumbnailUrl)
    .addFields(
      { name: 'Duration', value: formatDuration(song.duration), inline: true },
      { name: 'Requested by', value: song.requestedBy, inline: true },
      { name: 'Loop', value: formatLoopMode(loopMode), inline: true }
    );
}
