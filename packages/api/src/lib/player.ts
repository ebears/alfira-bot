import type { GuildPlayer } from '@alfira-bot/bot';
import { getPlayer } from '@alfira-bot/bot';
import { GUILD_ID } from './config';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function requirePlaying():
  | { ok: true; player: GuildPlayer }
  | { ok: false; response: Response } {
  const player = getPlayer(GUILD_ID);
  if (!player?.getCurrentSong()) {
    return {
      ok: false,
      response: json({ error: 'Nothing is currently playing.' }, 409),
    };
  }
  return { ok: true, player };
}

export function requirePlayer():
  | { ok: true; player: GuildPlayer }
  | { ok: false; response: Response } {
  const player = getPlayer(GUILD_ID);
  if (!player) {
    return {
      ok: false,
      response: json({ error: 'The bot is not connected.' }, 409),
    };
  }
  return { ok: true, player };
}
