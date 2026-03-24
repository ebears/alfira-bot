/**
 * Extracts user information from request or returns fallback values.
 * Used across API routes to standardize user extraction logic.
 */

const USERNAME_FALLBACK = 'Unknown';

export interface RequestUser {
  username?: string;
  discordId?: string;
}

export interface RequestedBy {
  username: string;
  discordId: string;
}

/**
 * Extracts username and discordId from a request-like object.
 * Returns fallback values if the user information is not available.
 */
export function getRequestedBy(req: { user?: RequestUser }): RequestedBy {
  return {
    username: req.user?.username ?? USERNAME_FALLBACK,
    discordId: req.user?.discordId ?? USERNAME_FALLBACK,
  };
}
