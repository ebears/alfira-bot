import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_BOT_TOKEN,
  GUILD_ID,
  JWT_SECRET,
  ADMIN_ROLE_IDS,
} = process.env;

// The web UI origin. In development this is the Vite dev server.
// In production, point this at your deployed frontend URL.
const WEB_UI_ORIGIN = process.env.WEB_UI_ORIGIN ?? 'http://localhost:5173';

const ADMIN_ROLE_ID_SET = new Set(
  (ADMIN_ROLE_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
);

const JWT_EXPIRES_IN = '7d';
const COOKIE_NAME = 'session';

// ---------------------------------------------------------------------------
// GET /auth/login
// ---------------------------------------------------------------------------
router.get('/login', (_req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID!,
    redirect_uri: DISCORD_REDIRECT_URI!,
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
          client_id: DISCORD_CLIENT_ID!,
          client_secret: DISCORD_CLIENT_SECRET!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: DISCORD_REDIRECT_URI!,
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
    let memberRoles: string[] = [];
    try {
      const memberRes = await axios.get(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${discordUser.id}`,
        { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
      );
      memberRoles = memberRes.data.roles ?? [];
    } catch (err: any) {
      if (err?.response?.status === 404) {
        res.status(403).json({ error: 'You must be a member of the server to use this app.' });
        return;
      }
      console.warn('Could not fetch guild member roles, defaulting to member access:', err?.message);
    }

    // 4. Determine isAdmin.
    const isAdmin = memberRoles.some((roleId) => ADMIN_ROLE_ID_SET.has(roleId));

    // 5. Build avatar URL.
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    // 6. Issue JWT.
    const payload = {
      discordId: discordUser.id,
      username: discordUser.username,
      avatar: avatarUrl,
      isAdmin,
    };

    const token = jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 7. Redirect to the web UI. The cookie travels with this redirect.
    res.redirect(WEB_UI_ORIGIN);
  })
);

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged out.' });
});

export default router;
