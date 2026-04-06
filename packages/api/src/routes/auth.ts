import crypto from 'node:crypto';
import { tables } from '@alfira-bot/shared/db';
import axios, { isAxiosError } from 'axios';
import { and, eq, lt } from 'drizzle-orm';
import { type Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { logger, WEB_UI_ORIGIN } from '../lib/config';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/requireAuth';

const { refreshToken: refreshTokenTable } = tables;

const router = Router();

// These are validated at boot in index.ts, so they're guaranteed to be set.
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_BOT_TOKEN,
  GUILD_ID,
  JWT_SECRET,
  ADMIN_ROLE_IDS,
} = process.env as Record<string, string>;

const ADMIN_ROLE_ID_SET = new Set(
  (ADMIN_ROLE_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

const isProduction = process.env.NODE_ENV === 'production';

function isAdminUser(memberRoles: string[]): boolean {
  return memberRoles.some((roleId) => ADMIN_ROLE_ID_SET.has(roleId));
}

// Access tokens are short-lived (1h). Refresh tokens are long-lived (7d default),
// stored as SHA-256 hashes, and single-use.
const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN ?? '7d';
const ACCESS_COOKIE_NAME = 'session';
const REFRESH_COOKIE_NAME = 'refresh_token';

const REFRESH_TOKEN_MAX_AGE = (() => {
  const match = REFRESH_TOKEN_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  if (!match) {
    logger.warn(`Invalid JWT_EXPIRES_IN format "${REFRESH_TOKEN_EXPIRES_IN}", defaulting to 7d`);
    return 7 * 24 * 60 * 60 * 1000;
  }
  const multipliers: Record<string, number> = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return parseInt(match[1], 10) * (multipliers[match[2]] ?? 86400000);
})();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(payload: {
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}): string {
  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function generateRefreshToken(discordId: string): string {
  return jwt.sign({ discordId, type: 'refresh' }, JWT_SECRET as string, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  // Access token cookie - short-lived
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Refresh token cookie - long-lived
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: isProduction });
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: isProduction });
}

/** Fetches guild member roles. Returns 'not-in-guild' on 404, null on other errors. */
async function fetchGuildMemberRoles(discordId: string): Promise<string[] | null | 'not-in-guild'> {
  try {
    const memberRes = await axios.get(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
    );
    return memberRes.data.roles ?? [];
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.status === 404) {
      return 'not-in-guild';
    }
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'Failed to fetch guild member roles'
    );
    return null;
  }
}

/** Returns null if the user is not in the guild or Discord is unreachable. */
async function fetchUserAdminStatus(
  discordId: string
): Promise<{ isAdmin: boolean; username: string; avatar: string | null } | null> {
  try {
    // Fetch user's current username/avatar
    const userRes = await axios.get(`https://discord.com/api/users/${discordId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
    const { username, avatar } = userRes.data;

    const roles = await fetchGuildMemberRoles(discordId);
    if (roles === null || roles === 'not-in-guild') return null;

    return {
      isAdmin: isAdminUser(roles),
      username,
      avatar: avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : null,
    };
  } catch (err: unknown) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'Failed to fetch user info from Discord'
    );
    return null;
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

/**
 * Exchange authorization code for Discord access token.
 * Returns null and sends error response on failure.
 */
async function exchangeAuthorizationCode(code: string, res: Response): Promise<string | null> {
  try {
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return tokenRes.data.access_token;
  } catch {
    res.status(502).json({ error: 'Failed to exchange authorization code with Discord.' });
    return null;
  }
}

/**
 * Fetch Discord user identity.
 * Returns null and sends error response on failure.
 */
async function fetchDiscordIdentity(
  discordToken: string,
  res: Response
): Promise<{ id: string; username: string; avatar: string | null } | null> {
  try {
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${discordToken}` },
    });
    return userRes.data;
  } catch {
    res.status(502).json({ error: 'Failed to fetch Discord user info.' });
    return null;
  }
}

/**
 * Verify guild membership and get member roles.
 * Returns null and sends error response on failure.
 */
async function verifyGuildMembership(discordId: string, res: Response): Promise<string[] | null> {
  const rolesResult = await fetchGuildMemberRoles(discordId);
  if (rolesResult === 'not-in-guild') {
    res.status(403).json({ error: 'You must be a member of the server to use this app.' });
    return null;
  }
  if (rolesResult === null) {
    res
      .status(503)
      .json({ error: 'Could not verify your server membership. Please try again in a moment.' });
    return null;
  }
  return rolesResult;
}

/**
 * Generate and store authentication tokens.
 */
async function generateAndStoreTokens(
  discordUser: { id: string; username: string; avatar: string | null },
  isAdmin: boolean
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = {
    discordId: discordUser.id,
    username: discordUser.username,
    avatar: discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null,
    isAdmin,
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(discordUser.id);

  // Store refresh token hash in database
  const refreshTokenHash = hashToken(refreshToken);
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
  await db.insert(refreshTokenTable).values({
    tokenHash: refreshTokenHash,
    discordId: discordUser.id,
    expiresAt: refreshTokenExpiry,
  });

  return { accessToken, refreshToken };
}

router.get('/login', authLimiter, (_req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get('/callback', authLimiter, async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing authorization code.' });
    return;
  }

  // 1. Exchange code for Discord access token.
  const discordToken = await exchangeAuthorizationCode(code, res);
  if (!discordToken) return;

  // 2. Fetch Discord identity.
  const discordUser = await fetchDiscordIdentity(discordToken, res);
  if (!discordUser) return;

  // 3. Verify guild membership and get member roles.
  const memberRoles = await verifyGuildMembership(discordUser.id, res);
  if (!memberRoles) return;

  // 4. Determine admin status.
  const isAdmin = isAdminUser(memberRoles);

  // 5. Generate and store tokens.
  const { accessToken, refreshToken } = await generateAndStoreTokens(discordUser, isAdmin);

  // 6. Set cookies and redirect.
  setAuthCookies(res, accessToken, refreshToken);
  res.redirect(WEB_UI_ORIGIN);
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token provided.' });
    return;
  }

  // 1. Verify the refresh token signature and expiration.
  let decoded: { discordId: string; type: string };
  try {
    decoded = jwt.verify(refreshToken, JWT_SECRET) as { discordId: string; type: string };
    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type.' });
      return;
    }
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Invalid or expired refresh token.' });
    return;
  }

  // 2. Check if the refresh token exists in the database (not revoked).
  const tokenHash = hashToken(refreshToken);
  const [storedToken] = await db
    .select()
    .from(refreshTokenTable)
    .where(eq(refreshTokenTable.tokenHash, tokenHash))
    .limit(1);
  if (!storedToken) {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Refresh token has been revoked.' });
    return;
  }

  // 3. Check if the refresh token has expired.
  if (storedToken.expiresAt < new Date()) {
    await db.delete(refreshTokenTable).where(eq(refreshTokenTable.id, storedToken.id));
    clearAuthCookies(res);
    res.status(401).json({ error: 'Refresh token has expired.' });
    return;
  }

  // 4. Delete the used refresh token (single-use for security).
  await db.delete(refreshTokenTable).where(eq(refreshTokenTable.id, storedToken.id));

  // 5. Clean up expired tokens for this user (lazy cleanup).
  await db
    .delete(refreshTokenTable)
    .where(
      and(
        eq(refreshTokenTable.discordId, decoded.discordId),
        lt(refreshTokenTable.expiresAt, new Date())
      )
    );

  // 6. Re-fetch user info from Discord (including admin status).
  const userInfo = await fetchUserAdminStatus(decoded.discordId);
  if (!userInfo) {
    // User is no longer in the guild or Discord is unreachable.
    // Clear all refresh tokens for this user for security.
    await db.delete(refreshTokenTable).where(eq(refreshTokenTable.discordId, decoded.discordId));
    clearAuthCookies(res);
    res.status(401).json({ error: 'Unable to verify user membership. Please log in again.' });
    return;
  }

  // 7. Generate new tokens.
  const payload = {
    discordId: decoded.discordId,
    username: userInfo.username,
    avatar: userInfo.avatar,
    isAdmin: userInfo.isAdmin,
  };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(decoded.discordId);

  // 8. Store new refresh token.
  const newTokenHash = hashToken(newRefreshToken);
  const newExpiry = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
  await db.insert(refreshTokenTable).values({
    tokenHash: newTokenHash,
    discordId: decoded.discordId,
    expiresAt: newExpiry,
  });

  // 9. Set cookies and return user info.
  setAuthCookies(res, newAccessToken, newRefreshToken);
  res.json({ user: payload });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', async (req, res) => {
  // Try to revoke the refresh token if present.
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    try {
      const tokenHash = hashToken(refreshToken);
      await db.delete(refreshTokenTable).where(eq(refreshTokenTable.tokenHash, tokenHash));
    } catch {
      logger.warn('Failed to revoke refresh token on logout');
    }
  }
  clearAuthCookies(res);
  res.json({ message: 'Logged out.' });
});

export default router;
