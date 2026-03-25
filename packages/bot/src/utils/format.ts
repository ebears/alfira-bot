import type { LoopMode } from '@alfira-bot/shared';

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const LOOP_MODE_LABELS: Record<LoopMode, string> = {
  off: '⬛ Off',
  song: '🔂 Song',
  queue: '🔁 Queue',
};

export const EMBED_COLOR = 0x5865f2;

export function formatLoopMode(mode: LoopMode): string {
  return LOOP_MODE_LABELS[mode];
}
