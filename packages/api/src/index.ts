import 'dotenv/config';
import { destroyAllPlayers, setBroadcastQueueUpdate, startBot } from '@alfira-bot/bot';
import { $client, db } from '@alfira-bot/shared/db';
import { parse } from 'cookie';
import { sql } from 'drizzle-orm';
import { logger } from './lib/config';
import { closeAllClients, emitPlayerUpdate, registerClient, unregisterClient } from './lib/socket';
import { verifySessionToken } from './middleware/requireAuth';
import { handleAuth } from './routes/auth';
import { handlePlayer } from './routes/player';
import { handlePlaylists } from './routes/playlists';
import { handleSongs } from './routes/songs';

// ---------------------------------------------------------------------------
// Validate required environment variables.
// ---------------------------------------------------------------------------
const requiredVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'GUILD_ID',
  'DATABASE_URL',
  'JWT_SECRET',
];
const missing = requiredVars.filter((v) => !process.env[v]);

if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`);
  logger.error('Copy packages/api/.env.example to packages/api/.env and fill in all values.');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------
export type RouteContext = {
  user: ReturnType<typeof verifySessionToken>;
  isAdmin: boolean;
  cookies: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
  });
}

function setSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (key === 'Set-Cookie') continue; // Don't overwrite Set-Cookie headers set by routes
    newHeaders.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers: newHeaders });
}

const STATIC_EXTENSIONS: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function serveStatic(filePath: string, pathname: string): Response | undefined {
  const file = Bun.file(filePath);
  if (file.size === 0) return undefined;
  const ext = pathname.includes('.') ? `.${pathname.split('.').pop()}` : '.html';
  const contentType = STATIC_EXTENSIONS[ext] ?? 'text/plain';
  return new Response(file, {
    headers: { 'Content-Type': contentType },
  });
}

// ---------------------------------------------------------------------------
// Route context creation
// ---------------------------------------------------------------------------

function createContext(request: Request): RouteContext {
  const parsedCookies = parse(request.headers.get('cookie') || '');
  const token = parsedCookies.session;
  const user = token ? verifySessionToken(token) : null;
  const cookies: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsedCookies)) {
    if (value !== undefined) cookies[key] = value;
  }
  return { user, isAdmin: user?.isAdmin ?? false, cookies };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

async function handleHealth(): Promise<Response> {
  try {
    await db.execute(sql`SELECT 1`);
    return json({ status: 'ok' });
  } catch {
    return json({ status: 'degraded' }, 503);
  }
}

// ---------------------------------------------------------------------------
// Main server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return setSecurityHeaders(await handleHealth());
    }

    // WebSocket upgrade — auth is handled here before upgrade
    if (url.pathname === '/ws') {
      const cookies = parse(request.headers.get('cookie') || '');
      const token = cookies.session;
      const user = token ? verifySessionToken(token) : null;
      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }
      // Use server.upgrade() instead of WebSocketPair — it auto-returns 101
      // and attaches data to the WebSocket accessible in the websocket handler.
      const success = server.upgrade(request, { data: { user } });
      if (success) return undefined;
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    // Serve built web assets statically (SPA fallback for client-side routing)
    const ASSET_EXTENSIONS = [
      '.js',
      '.css',
      '.png',
      '.jpg',
      '.jpeg',
      '.svg',
      '.ico',
      '.webmanifest',
      '.woff2',
    ];
    const isAsset =
      ASSET_EXTENSIONS.some((ext) => url.pathname.endsWith(ext)) ||
      url.pathname.startsWith('/assets/') ||
      url.pathname === '/sw.js' ||
      url.pathname === '/registerSW.js';

    if (isAsset || url.pathname === '/') {
      const filePath = `/app/packages/web/dist${url.pathname === '/' ? '/index.html' : url.pathname}`;
      const response = serveStatic(filePath, url.pathname);
      if (response) return response;
    }

    // Create auth context for all other routes
    const ctx = createContext(request);

    // Route matching
    if (url.pathname.startsWith('/api/songs')) {
      return setSecurityHeaders(await handleSongs(ctx, request));
    }
    if (url.pathname.startsWith('/api/playlists')) {
      return setSecurityHeaders(await handlePlaylists(ctx, request));
    }
    if (url.pathname.startsWith('/api/player')) {
      return setSecurityHeaders(await handlePlayer(ctx, request));
    }
    if (url.pathname.startsWith('/auth')) {
      return setSecurityHeaders(await handleAuth(ctx, request));
    }

    return (
      serveStatic('/app/packages/web/dist/index.html', '/index.html') ??
      setSecurityHeaders(json({ error: 'Not Found' }, 404))
    );
  },
  websocket: {
    data: {} as { user: NonNullable<ReturnType<typeof verifySessionToken>> },
    open(ws) {
      // Log only — user was stored via server.upgrade() data.
      // biome-ignore lint/suspicious/noExplicitAny: ServerWebSocket doesn't expose id at type level
      logger.debug({ socketId: (ws as any).id }, 'WebSocket opened');
      registerClient(ws, ws.data.user);
    },
    message(ws, message) {
      // No-op: client does not send messages
      // biome-ignore lint/suspicious/noExplicitAny: ServerWebSocket doesn't expose id at type level
      logger.debug({ socketId: (ws as any).id, message }, 'Unexpected WebSocket message received');
    },
    close(ws, code, reason) {
      unregisterClient(ws);
      // biome-ignore lint/suspicious/noExplicitAny: ServerWebSocket doesn't expose id at type level
      logger.info({ socketId: (ws as any).id, code, reason }, 'WebSocket closed');
    },
  },
});

logger.info({ port: PORT }, 'Bun server listening');

// ---------------------------------------------------------------------------
// Startup sequence
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // 1. Verify database connectivity.
  try {
    await db.execute(sql`SELECT 1`);
    logger.info('Connected to database');
  } catch (error) {
    logger.error(error, 'Could not connect to the database');
    logger.error('Is PostgreSQL running? Try: docker compose up -d');
    process.exit(1);
  }

  // 2. Inject the broadcast function into the bot package.
  setBroadcastQueueUpdate(emitPlayerUpdate);

  // 3. Start the Discord bot.
  try {
    await startBot();
  } catch (error) {
    logger.error(error, 'Failed to start the Discord bot');
  }
}

main().catch((err) => {
  logger.fatal(err, 'Fatal startup error');
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Starting graceful shutdown');

  // 1. Stop accepting connections and close all WebSocket clients.
  server.stop();
  closeAllClients();
  logger.info('Server stopped');

  // 2. Destroy all players (FFmpeg + voice connections).
  destroyAllPlayers();
  logger.info('All players destroyed');

  // 3. Close database connection.
  await $client.end();
  logger.info('Database disconnected');

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
