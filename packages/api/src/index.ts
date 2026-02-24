import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import songsRouter from './routes/songs';
import playlistsRouter from './routes/playlists';
import playerRouter from './routes/player';
import authRouter from './routes/auth';
import { startBot } from '@discord-music-bot/bot';

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
  origin: 'http://localhost:5173', // Web UI origin (Phase 6)
  credentials: true,               // Required for cookies to be sent cross-origin
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

// Health check — useful for verifying the server is up before running tests.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler — must be registered last.
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup sequence
//
// Order matters:
//   1. Verify the database is reachable before accepting traffic.
//   2. Start the HTTP server.
//   3. Start the Discord bot.
//
// The bot starts last so that if it fails, the API is still running and can
// report the error clearly rather than crashing the whole process silently.
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

  // 2. Start the HTTP server.
  app.listen(PORT, () => {
    console.log(`✅  API listening on http://localhost:${PORT}`);
  });

  // 3. Start the Discord bot.
  try {
    await startBot();
  } catch (error) {
    console.error('❌  Failed to start the Discord bot:', error);
    // Don't exit — the API is still useful for testing even if the bot fails.
  }
}

main();
