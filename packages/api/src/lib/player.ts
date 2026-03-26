import { getPlayer, GuildPlayer } from '@alfira-bot/bot';
import type { Response } from 'express';
import { GUILD_ID } from './config';

export function requirePlaying(res: Response): GuildPlayer | null {
  const player = getPlayer(GUILD_ID);
  if (!player || !player.getCurrentSong()) {
    res.status(409).json({ error: 'Nothing is currently playing.' });
    return null;
  }
  return player;
}

export function requirePlayer(res: Response): GuildPlayer | null {
  const player = getPlayer(GUILD_ID);
  if (!player) {
    res.status(409).json({ error: 'The bot is not connected.' });
    return null;
  }
  return player;
}
