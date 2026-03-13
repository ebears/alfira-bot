// ---------------------------------------------------------------------------
// @alfira-bot/shared — formatting utilities
//
// Shared formatting functions used across bot and web packages.
// ---------------------------------------------------------------------------

/**
 * Converts a duration in whole seconds to an M:SS display string.
 *
 * Examples:
 *   formatDuration(0)    → "0:00"
 *   formatDuration(90)   → "1:30"
 *   formatDuration(3661) → "61:01"
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
