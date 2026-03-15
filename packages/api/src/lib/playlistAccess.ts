import type { Response } from 'express';

export interface UserContext {
  discordId?: string;
  isAdmin?: boolean;
}

interface PlaylistLike {
  createdBy: string;
  isPrivate: boolean;
}

/**
 * Checks if user can view/modify a playlist.
 * - Public playlists: always accessible
 * - Private playlists: accessible to creator or admins (when adminView is true)
 * If res is provided, sends 403 on denial.
 */
export function canAccessPlaylist(
  playlist: PlaylistLike,
  user: UserContext | undefined,
  res?: Response,
  adminView?: boolean
): boolean {
  if (!playlist.isPrivate) return true;
  const allowed =
    playlist.createdBy === user?.discordId || (user?.isAdmin === true && adminView === true);
  if (!allowed && res) {
    res.status(403).json({ error: 'Access denied. This playlist is private.' });
  }
  return allowed;
}
