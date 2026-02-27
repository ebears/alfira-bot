import type { LoopMode } from '@discord-music-bot/shared';

// ---------------------------------------------------------------------------
// formatDuration
//
// Converts a duration in whole seconds to an M:SS display string.
// Used in "Now Playing" embeds and queue listings.
//
// Examples:
//   formatDuration(0)    → "0:00"
//   formatDuration(90)   → "1:30"
//   formatDuration(3661) → "61:01"
// ---------------------------------------------------------------------------
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
    off:   '⬛ Off',
    song:  '🔂 Song',
    queue: '🔁 Queue',
  };
  return labels[mode];
}
