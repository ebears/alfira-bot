import crypto from 'node:crypto';
import axios, { isAxiosError } from 'axios';
import { type Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// ---------------------------------------------------------------------------
// Environment variable validation
// ---------------------------------------------------------------------------
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_BOT_TOKEN,
  GUILD_ID,
  JWT_SECRET,
  ADMIN_ROLE_IDS,
} = process.env;

if (
  !DISCORD_CLIENT_ID ||
  !DISCORD_CLIENT_SECRET ||
  !DISCORD_REDIRECT_URI ||
  !DISCORD_BOT_TOKEN ||
  !GUILD_ID ||
  !JWT_SECRET
) {
  throw new Error(
    'Missing required environment variables: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, DISCORD_BOT_TOKEN, GUILD_ID, JWT_SECRET'
  );
}

// The web UI origin. In development this is the Vite dev server.
// In production, point this at your deployed frontend URL.
const WEB_UI_ORIGIN = process.env.WEB_UI_ORIGIN ?? 'http://localhost:5173';

const ADMIN_ROLE_ID_SET = new Set(
  (ADMIN_ROLE_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

// ---------------------------------------------------------------------------
// Helper: Build Discord avatar URL
//
// Returns the full CDN URL for a user's avatar, or null if no avatar hash.
// ---------------------------------------------------------------------------
function buildAvatarUrl(discordId: string, avatar: string | null): string | null {
  return avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : null;
}

// ---------------------------------------------------------------------------
// Token configuration
//
// Access tokens are short-lived (1 hour) and contain the user's info including
// isAdmin status. This limits the window where a revoked admin can still
// access admin features.
//
// Refresh tokens are long-lived (7 days by default) and stored in the database
// as a SHA-256 hash. They can be revoked by deleting them from the database.
// When a user refreshes, we re-fetch their roles from Discord to ensure
// admin status is up-to-date.
// ---------------------------------------------------------------------------
const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN ?? '7d';
const ACCESS_COOKIE_NAME = 'session';
const REFRESH_COOKIE_NAME = 'refresh_token';

// ---------------------------------------------------------------------------
// Helper: Parse duration string to milliseconds
//
// Parses strings like '7d', '1h', '30m' into milliseconds.
// This is used to sync cookie maxAge and database expiry with JWT expiry.
// ---------------------------------------------------------------------------
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) {
    console.warn(`Invalid JWT_EXPIRES_IN format "${duration}", defaulting to 7d`);
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

const REFRESH_TOKEN_MAX_AGE = parseDuration(REFRESH_TOKEN_EXPIRES_IN);

// ---------------------------------------------------------------------------
// Helper: Hash a token using SHA-256
//
// We store only the hash of refresh tokens in the database.
// This means even if the database is compromised, the tokens cannot be used.
// ---------------------------------------------------------------------------
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Helper: Generate access token
//
// Contains user info including isAdmin. Short-lived so role changes take
// effect within 1 hour maximum.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helper: Generate refresh token
//
// Contains only the discord ID. Long-lived and stored in DB for revocation.
// ---------------------------------------------------------------------------
function generateRefreshToken(discordId: string): string {
  return jwt.sign({ discordId, type: 'refresh' }, JWT_SECRET as string, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

// ---------------------------------------------------------------------------
// Helper: Set auth cookies
// ---------------------------------------------------------------------------
function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const isProduction = process.env.NODE_ENV === 'production';

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

// ---------------------------------------------------------------------------
// Helper: Clear auth cookies
// ---------------------------------------------------------------------------
function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
}

// ---------------------------------------------------------------------------
// Helper: Fetch user's admin status from Discord
//
// Returns null if the user is not in the guild or Discord is unreachable.
// ---------------------------------------------------------------------------
async function fetchUserAdminStatus(
  discordId: string
): Promise<{ isAdmin: boolean; username: string; avatar: string | null } | null> {
  try {
    // Fetch user's current username/avatar
    const userRes = await axios.get(`https://discord.com/api/users/${discordId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
    const { username, avatar } = userRes.data;

    // Fetch member roles to determine admin status
    const memberRes = await axios.get(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
      {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      }
    );
    const memberRoles: string[] = memberRes.data.roles ?? [];
    const isAdmin = memberRoles.some((roleId) => ADMIN_ROLE_ID_SET.has(roleId));

    return { isAdmin, username, avatar: buildAvatarUrl(discordId, avatar) };
  } catch (err: unknown) {
    // User not in guild
    if (isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    // Discord error - log and return null
    console.error(
      'Failed to fetch user info from Discord:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting
//
// Applied to /auth/login, /auth/callback, and /auth/refresh.
//
// Why: without rate limiting, an attacker can hammer the OAuth flow to probe
// for valid guild members or attempt to enumerate users. The callback is
// equally important — a burst of crafted requests can be used to exhaust
// Discord API quota or cause unexpected server behaviour.
//
// Limits: 20 requests per 15 minutes per IP. This is generous enough for
// normal usage (a user retrying after a misconfigured redirect) but tight
// enough to stop automated scanning.
//
// keyGenerator: uses req.ip, which Express populates correctly only after
// trust proxy is set in index.ts. Without that setting, all requests would
// appear to come from the Caddy machine's IP and share a single bucket.
//
// skipSuccessfulRequests: true so that legitimate logins don't count against
// the limit. Only failed or abnormal requests burn tokens.
// ---------------------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

// ---------------------------------------------------------------------------
// GET /auth/login
// ---------------------------------------------------------------------------
router.get('/login', authLimiter, (_req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// ---------------------------------------------------------------------------
// GET /auth/callback
// ---------------------------------------------------------------------------
router.get(
  '/callback',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code.' });
      return;
    }

    // 1. Exchange code for Discord access token.
    let discordToken: string;
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
      discordToken = tokenRes.data.access_token;
    } catch {
      res.status(502).json({ error: 'Failed to exchange authorization code with Discord.' });
      return;
    }

    // 2. Fetch Discord identity.
    let discordUser: { id: string; username: string; avatar: string | null };
    try {
      const userRes = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${discordToken}` },
      });
      discordUser = userRes.data;
    } catch {
      res.status(502).json({ error: 'Failed to fetch Discord user info.' });
      return;
    }

    // 3. Fetch guild member roles via bot token.
    //
    // Three outcomes:
    // - Success (2xx): proceed with the real role list.
    // - 404: user is not in the guild — deny login.
    // - Anything else (network error, rate limit, 5xx from Discord): fail
    // closed. We do not know the user's roles, so we cannot safely issue
    // a token. Logging in with an assumed role list would mean a Discord
    // outage silently grants or revokes admin access depending on which
    // direction we default. Refusing is the only safe option.
    let memberRoles: string[];
    try {
      const memberRes = await axios.get(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${discordUser.id}`,
        { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
      );
      memberRoles = memberRes.data.roles ?? [];
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) {
        res.status(403).json({ error: 'You must be a member of the server to use this app.' });
        return;
      }
      // Discord is unreachable or returned an unexpected error.
      // Log the detail server-side; return a generic message to the client.
      console.error(
        'Failed to fetch guild member roles for user',
        discordUser.id,
        '— denying login.',
        err instanceof Error ? err.message : String(err)
      );
      res
        .status(503)
        .json({ error: 'Could not verify your server membership. Please try again in a moment.' });
      return;
    }

    // 4. Determine isAdmin.
    const isAdmin = memberRoles.some((roleId) => ADMIN_ROLE_ID_SET.has(roleId));

    // 5. Generate tokens.
    const payload = {
      discordId: discordUser.id,
      username: discordUser.username,
      avatar: buildAvatarUrl(discordUser.id, discordUser.avatar),
      isAdmin,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(discordUser.id);

    // 7. Store refresh token hash in database.
    const refreshTokenHash = hashToken(refreshToken);
    const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        discordId: discordUser.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // 8. Set cookies and redirect.
    setAuthCookies(res, accessToken, refreshToken);
    res.redirect(WEB_UI_ORIGIN);
  })
);

// ---------------------------------------------------------------------------
// POST /auth/refresh
//
// Exchange a refresh token for a new access token.
// This also re-fetches the user's admin status from Discord to ensure
// role changes take effect quickly.
// ---------------------------------------------------------------------------
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
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
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!storedToken) {
      clearAuthCookies(res);
      res.status(401).json({ error: 'Refresh token has been revoked.' });
      return;
    }

    // 3. Check if the refresh token has expired.
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      clearAuthCookies(res);
      res.status(401).json({ error: 'Refresh token has expired.' });
      return;
    }

    // 4. Delete the used refresh token (single-use for security).
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // 5. Clean up expired tokens for this user (lazy cleanup).
    await prisma.refreshToken.deleteMany({
      where: {
        discordId: decoded.discordId,
        expiresAt: { lt: new Date() },
      },
    });

    // 6. Re-fetch user info from Discord (including admin status).
    const userInfo = await fetchUserAdminStatus(decoded.discordId);
    if (!userInfo) {
      // User is no longer in the guild or Discord is unreachable.
      // Clear all refresh tokens for this user for security.
      await prisma.refreshToken.deleteMany({ where: { discordId: decoded.discordId } });
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
    await prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        discordId: decoded.discordId,
        expiresAt: newExpiry,
      },
    });

    // 9. Set cookies and return user info.
    setAuthCookies(res, newAccessToken, newRefreshToken);
    res.json({ user: payload });
  })
);

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Try to revoke the refresh token if present.
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      try {
        const tokenHash = hashToken(refreshToken);
        await prisma.refreshToken.deleteMany({ where: { tokenHash } });
      } catch {
        // Ignore errors - just clear cookies anyway.
      }
    }
    clearAuthCookies(res);
    res.json({ message: 'Logged out.' });
  })
);

export default router;
