import 'dotenv/config';
import http from 'node:http';
import { destroyAllPlayers, setBroadcastQueueUpdate, startBot } from '@alfira-bot/bot';
import { $client, db } from '@alfira-bot/shared/db';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { sql } from 'drizzle-orm';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger, WEB_UI_ORIGIN } from './lib/config';
import { emitPlayerUpdate, getIo, initSocket } from './lib/socket';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import playerRouter from './routes/player';
import playlistsRouter from './routes/playlists';
import songsRouter from './routes/songs';

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
// Build the Express app.
// ---------------------------------------------------------------------------
const app = express();

app.set('trust proxy', process.env.TRUSTED_PROXY_IP ?? false);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
      },
    },
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
    await db.execute(sql`SELECT 1`);
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

// Global error handler — must be registered last.
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Create the HTTP server.
// ---------------------------------------------------------------------------
const httpServer = http.createServer(app);

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

  // 2. Initialise Socket.io.
  initSocket(httpServer);

  // 3. Inject the broadcast function into the bot package.
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

  // 4. Close database connection.
  await $client.end();
  logger.info('Database disconnected');

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
