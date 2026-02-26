## Security Audit: alfira-bot

### 🟢 What's Done Well

The auth model is fundamentally sound. All API routes consistently apply `requireAuth` and `requireAdmin` middleware — there's no whitelist-based bypass pattern. JWT verification happens on every protected request, and the token is stored in an `HttpOnly` cookie (inaccessible to JavaScript), which is correct. CORS is locked to `WEB_UI_ORIGIN`. The `execFile` usage in `ytdlp.ts` (vs `exec`) correctly prevents shell injection. Prisma's parameterized queries prevent SQL injection throughout.

---

### ✅ Fixed

**1. Hardcoded database credentials in production compose**

`docker-compose.prod.yml` previously hardcoded `botuser:botpass` as database credentials. These are now sourced from environment variables (`${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB}`), consistent with how `DISCORD_BOT_TOKEN` and other secrets are handled. The `.env.example` files have been updated with `CHANGE_ME_STRONG_PASSWORD` placeholders and a command for generating a strong `JWT_SECRET`.

**2. API port exposed by default in production compose**

The `ports:` entry for the API previously mapped `3001:3001` on all interfaces. It now binds to `${DOCKER_HOST_IP}:3001` — the specific LAN IP of the machine running the containers. This means the port is only reachable from your LAN, not from all interfaces. Caddy on a separate machine can still reach it; nothing else can.

**3. Reverse proxy trust configured correctly**

Express is now configured to trust `X-Forwarded-For` only when the request arrives from the Caddy machine:

```typescript
app.set('trust proxy', process.env.TRUSTED_PROXY_IP ?? false);
```

Without this, rate limiters and IP-based logging see every request as coming from the Caddy machine's IP (all users share one bucket). With `true` or `1`, any client could spoof their IP by sending a crafted `X-Forwarded-For` header directly to port 3001. Using the specific Caddy IP means the header is only trusted from the one machine that's actually a legitimate proxy. Two environment variables were split to handle this cleanly:

- `DOCKER_HOST_IP` — the LAN IP of the machine running Docker (used in `ports:` binding)
- `TRUSTED_PROXY_IP` — the LAN IP of the Caddy machine (used in `app.set('trust proxy', ...)`)

**4. Rate limiting on auth endpoints**

`/auth/login` and `/auth/callback` now have rate limiting via `express-rate-limit`:

```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});
```

`skipSuccessfulRequests: true` means legitimate logins don't burn tokens — only failed or abnormal requests count. The `keyGenerator` correctly uses `req.ip`, which Express now resolves to the real client IP via the trust proxy setting above. Without Fix 3 in place, this rate limiter would be ineffective (all users would share one bucket at the Caddy machine's IP).

**5. JWT_SECRET and DISCORD_CLIENT_SECRET missing from required vars check**

Both are now included in the `requiredVars` array in `index.ts`:

```typescript
const requiredVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'GUILD_ID',
  'DATABASE_URL',
  'JWT_SECRET',
];
```

Previously the server would start successfully with either variable missing, then fail mid-request with a cryptic runtime error — JWT signing would throw when attempting to issue a token, and the OAuth exchange would return a 401 from Discord with no useful log output. The server now exits immediately at boot with a clear message listing which variables are absent.

**6. Silent fail-open on role fetch**

The catch block in `/auth/callback` now fails closed. Previously, any error from Discord's guild member API that wasn't a 404 (user not in guild) would silently default to member access with a `console.warn`. The problem with defaulting either way is that a Discord outage would silently grant or revoke admin access depending on the chosen default — neither is safe.

The updated logic has three explicit outcomes: success proceeds normally, 404 denies with a clear message, and everything else returns a 503 and refuses to issue a token:

```typescript
} catch (err: any) {
  if (err?.response?.status === 404) {
    res.status(403).json({ error: 'You must be a member of the server to use this app.' });
    return;
  }
  console.error('Failed to fetch guild member roles for user', discordUser.id, '— denying login.', err?.message);
  res.status(503).json({ error: 'Could not verify your server membership. Please try again in a moment.' });
  return;
}
```

The type of `memberRoles` also changed from `string[] = []` to `string[]` with no initializer — TypeScript now enforces that the variable is only reachable after a successful fetch.

---

### 🔴 Open: High

**No remaining high-severity issues.**

---

### 🟡 Open: Medium

**7. yt-dlp pulled from `latest` with no integrity check**

```dockerfile
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
```
`latest` is resolved at build time with no checksum or signature verification. A compromised release or MITM could inject a malicious binary. Pin to a specific version and verify the hash:
```dockerfile
curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2025.03.31/yt-dlp \
  -o /usr/local/bin/yt-dlp
echo "EXPECTED_SHA256  /usr/local/bin/yt-dlp" | sha256sum -c
```

**8. Admin check relies entirely on JWT, never re-validated**

`isAdmin` is encoded into a JWT that's valid for 7 days. If a user's admin role is revoked in Discord, they retain admin access for up to 7 days. There's no mechanism to invalidate existing tokens. For a private/family bot this is probably acceptable, but for any wider deployment consider short-lived access tokens (1 hour) with a refresh flow, or a server-side session store that can be invalidated.

**9. No input length limits**

`createPlaylist`, `renamePlaylist`, and `addSong` don't validate string lengths. A user can submit a playlist name that's 10MB long. Add `name.length > 200` guards before hitting the database.

---

### 🔵 Open: Low / Hardening

**10. Missing security headers**

No `helmet` or equivalent. The API doesn't set `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, or `Referrer-Policy`. Add `helmet` as a middleware:
```typescript
import helmet from 'helmet';
app.use(helmet());
```

**11. Socket.io has no authentication**

Anyone who can reach the API port can open a WebSocket connection and receive all `player:update`, `songs:added`, etc. events without a JWT check. For a self-hosted private bot this is low risk, but it means anyone on your LAN reaching port 3001 gets a live feed of your song library and queue. Add Socket.io middleware:
```typescript
io.use((socket, next) => {
  // verify the session cookie from socket.handshake.headers.cookie
});
```

**12. `prisma.$connect()` is a no-op**

Prisma lazy-connects on first query; calling `$connect()` explicitly doesn't actually verify the database is reachable. Replace with:
```typescript
await prisma.$queryRaw`SELECT 1`;
```

---

### Summary Table

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Hardcoded DB creds in compose | 🔴 High | ✅ Fixed |
| 2 | API port exposed on all interfaces | 🔴 High | ✅ Fixed |
| 3 | Trust proxy misconfigured | 🔴 High | ✅ Fixed |
| 4 | No rate limiting on auth | 🔴 High | ✅ Fixed |
| 5 | JWT_SECRET not in required vars check | 🟡 Medium | ✅ Fixed |
| 6 | Silent fail-open on role fetch | 🟡 Medium | ✅ Fixed |
| 7 | yt-dlp unpinned + no hash check | 🟡 Medium | Open |
| 8 | 7-day JWT, no revocation | 🟡 Medium | Open |
| 9 | No input length validation | 🟡 Medium | Open |
| 10 | Missing security headers | 🔵 Low | Open |
| 11 | Socket.io unauthenticated | 🔵 Low | Open |
| 12 | `prisma.$connect()` ineffective | 🔵 Low | Open |

All high-severity issues are resolved. The remaining fixes are hardening improvements that reduce the attack surface incrementally.
