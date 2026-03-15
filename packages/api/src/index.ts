import 'dotenv/config';
import http from 'node:http';
import { destroyAllPlayers, setBroadcastQueueUpdate, startBot } from '@alfira-bot/bot';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { WEB_UI_ORIGIN } from './lib/config';
import logger from './lib/logger';
import prisma from './lib/prisma';
import { emitPlayerUpdate, getIo, initSocket } from './lib/socket';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import playerRouter from './routes/player';
import playlistsRouter from './routes/playlists';
import songsRouter from './routes/songs';

// ---------------------------------------------------------------------------
// Validate required environment variables.
//
// JWT_SECRET and DISCORD_CLIENT_SECRET are included here even though they
// aren't used directly in this file. Without them the server starts fine but
// then fails mid-request in auth flows — JWT signing throws at runtime and
// the OAuth token exchange returns a 401 from Discord. Catching both at boot
// gives a clear error message instead of a cryptic runtime failure.
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
// Build the Express app.
// ---------------------------------------------------------------------------
const app = express();

// Trust X-Forwarded-For only from the Caddy machine.
// Replace with your actual Caddy machine's LAN IP.
app.set('trust proxy', process.env.TRUSTED_PROXY_IP ?? false);

// Security headers middleware.
// CSP is disabled since this is an API-only server; the web frontend
// should set its own Content-Security-Policy.
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: WEB_UI_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Request logging with structured JSON output.
app.use(pinoHttp({ logger }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/songs', songsRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/player', playerRouter);
app.use('/auth', authRouter);

// Health check — verifies database connectivity.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

// Global error handler — must be registered last.
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Create the HTTP server.
//
// We wrap Express in a plain http.Server so Socket.io can share the same
// port. Both HTTP (REST) and WebSocket (Socket.io) traffic are handled on
// PORT=3001 — no extra port needed.
// ---------------------------------------------------------------------------
const httpServer = http.createServer(app);

// ---------------------------------------------------------------------------
// Startup sequence
//
// Order matters:
//   1. Verify the database is reachable.
//   2. Initialise Socket.io on the HTTP server.
//   3. Inject the broadcast function into the bot package so GuildPlayer can
//      call broadcastQueueUpdate() without importing from the API.
//   4. Start the HTTP server.
//   5. Start the Discord bot.
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // 1. Verify database connectivity.
  // Prisma's $connect() is lazy and doesn't actually validate the connection.
  // Use a raw query to ensure the database is reachable before proceeding.
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Connected to database');
  } catch (error) {
    logger.error(error, 'Could not connect to the database');
    logger.error('Is PostgreSQL running? Try: docker compose up -d');
    process.exit(1);
  }

  // 2. Initialise Socket.io.
  initSocket(httpServer);

  // 3. Inject the broadcast function into the bot package.
  //    GuildPlayer calls broadcastQueueUpdate() after every state change;
  //    this wires it to the real Socket.io emit.
  setBroadcastQueueUpdate(emitPlayerUpdate);

  // 4. Start the HTTP server (Express + Socket.io on the same port).
  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'API + Socket.io listening');
  });

  // 5. Start the Discord bot.
  try {
    await startBot();
  } catch (error) {
    logger.error(error, 'Failed to start the Discord bot');
    // Don't exit — the API is still useful for testing even if the bot fails.
  }
}

main().catch((err) => {
  logger.fatal(err, 'Fatal startup error');
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
//
// On SIGTERM (Docker stop, k8s) or SIGINT (Ctrl+C):
//   1. Stop accepting new HTTP connections.
//   2. Disconnect all Socket.io clients.
//   3. Destroy all GuildPlayers (stops FFmpeg, tears down voice connections).
//   4. Disconnect Prisma.
//   5. Exit cleanly.
// ---------------------------------------------------------------------------
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Starting graceful shutdown');

  // 1. Stop accepting new connections.
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // 2. Disconnect all Socket.io clients.
  const io = getIo();
  if (io) {
    io.disconnectSockets(true);
    await io.close();
    logger.info('Socket.io closed');
  }

  // 3. Destroy all players (FFmpeg + voice connections).
  destroyAllPlayers();
  logger.info('All players destroyed');

  // 4. Disconnect database.
  await prisma.$disconnect();
  logger.info('Database disconnected');

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
