import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import prisma from './lib/prisma';
import { initSocket, emitPlayerUpdate } from './lib/socket';
import { errorHandler } from './middleware/errorHandler';
import songsRouter from './routes/songs';
import playlistsRouter from './routes/playlists';
import playerRouter from './routes/player';
import authRouter from './routes/auth';
import { startBot } from '@discord-music-bot/bot';
import { setBroadcastQueueUpdate } from '@discord-music-bot/bot/src/lib/broadcast';

// ---------------------------------------------------------------------------
// Validate required environment variables.
// ---------------------------------------------------------------------------
const requiredVars = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'GUILD_ID', 'DATABASE_URL'];
const missing = requiredVars.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌  Missing required environment variables: ${missing.join(', ')}`);
  console.error('    Copy packages/api/.env.example to packages/api/.env and fill in all values.');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ---------------------------------------------------------------------------
// Build the Express app.
// ---------------------------------------------------------------------------
const app = express();

app.use(cors({
  origin: process.env.WEB_UI_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/songs', songsRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/player', playerRouter);
app.use('/auth', authRouter);

// Health check — useful for verifying the server is up.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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
  try {
    await prisma.$connect();
    console.log('✅  Connected to database.');
  } catch (error) {
    console.error('❌  Could not connect to the database:', error);
    console.error('    Is PostgreSQL running? Try: docker compose up -d');
    process.exit(1);
  }

  // 2. Initialise Socket.io.
  initSocket(httpServer);

  // 3. Inject the broadcast function into the bot package.
  //    GuildPlayer calls broadcastQueueUpdate() after every state change;
  //    this wires it to the real Socket.io emit.
  setBroadcastQueueUpdate((state) => {
    emitPlayerUpdate(state);
  });

  // 4. Start the HTTP server (Express + Socket.io on the same port).
  httpServer.listen(PORT, () => {
    console.log(`✅  API + Socket.io listening on http://localhost:${PORT}`);
  });

  // 5. Start the Discord bot.
  try {
    await startBot();
  } catch (error) {
    console.error('❌  Failed to start the Discord bot:', error);
    // Don't exit — the API is still useful for testing even if the bot fails.
  }
}

main();
