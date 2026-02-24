import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// ---------------------------------------------------------------------------
// Read config once at module load so missing values are caught at startup.
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

const ADMIN_ROLE_ID_SET = new Set(
  (ADMIN_ROLE_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
);

// JWT lifetime. Re-logging in always issues a fresh token.
const JWT_EXPIRES_IN = '7d';

// Cookie name. Consistent across all auth routes.
const COOKIE_NAME = 'session';

// ---------------------------------------------------------------------------
// GET /auth/login
//
// Redirects the user to Discord's OAuth2 authorization page.
// We only request 'identify' — the user's ID, username, and avatar.
// Role membership is checked server-side using the bot token (see callback).
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
//
// Handles the OAuth2 redirect from Discord. Flow:
//   1. Exchange the authorization code for a Discord access token.
//   2. Fetch the user's Discord identity (id, username, avatar).
//   3. Use the bot token to fetch the user's guild member record and roles.
//      This avoids needing the 'guilds.members.read' OAuth scope, which
//      would require adding 'bot' scope and complicating the auth URL.
//   4. Determine isAdmin by checking roles against ADMIN_ROLE_IDS.
//   5. Issue a signed JWT and set it as an HttpOnly cookie.
//   6. Return JSON with the user info (Phase 6 will redirect to the UI instead).
// ---------------------------------------------------------------------------
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code.' });
      return;
    }

    // Step 1: exchange code for Discord access token.
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

    // Step 2: fetch the user's Discord identity.
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

    // Step 3: fetch the user's guild member record using the bot token.
    // This gives us their role IDs without requiring additional OAuth scopes.
    let memberRoles: string[] = [];
    try {
      const memberRes = await axios.get(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${discordUser.id}`,
        { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
      );
      memberRoles = memberRes.data.roles ?? [];
    } catch (err: any) {
      if (err?.response?.status === 404) {
        // User is not in the guild — they cannot use this app.
        res.status(403).json({ error: 'You must be a member of the server to use this app.' });
        return;
      }
      // Any other error: proceed without roles (user will be treated as member).
      console.warn('Could not fetch guild member roles, defaulting to member access:', err?.message);
    }

    // Step 4: determine isAdmin.
    const isAdmin = memberRoles.some((roleId) => ADMIN_ROLE_ID_SET.has(roleId));

    // Step 5: build avatar URL. Discord avatars are served from their CDN.
    // If the user has no custom avatar, null is fine — the UI will show a fallback.
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    // Step 6: issue the JWT.
    const payload = {
      discordId: discordUser.id,
      username: discordUser.username,
      avatar: avatarUrl,
      isAdmin,
    };

    const token = jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,   // Not accessible via document.cookie — prevents XSS theft.
      sameSite: 'lax',  // Sent on same-site navigations; blocks cross-site CSRF.
      secure: process.env.NODE_ENV === 'production', // HTTPS-only in production.
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds.
    });

    // Phase 6: change this to res.redirect('http://localhost:5173') once the
    // web UI exists. The cookie will be sent with that redirect automatically.
    res.json({
      message: 'Login successful.',
      user: payload,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /auth/me
//
// Returns the current user's info decoded from the JWT cookie.
// The requireAuth middleware verifies the JWT and attaches req.user.
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
//
// Clears the session cookie. The JWT itself is not invalidated server-side
// (stateless JWTs can't be revoked without a blocklist). The 7-day expiry
// means a stolen-but-cleared token is valid until expiry, which is an
// acceptable trade-off for a single-server self-hosted app.
// ---------------------------------------------------------------------------
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged out.' });
});

export default router;
