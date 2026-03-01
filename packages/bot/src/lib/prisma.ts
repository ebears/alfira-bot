import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@discord-music-bot/api/src/generated/prisma/client';

// ---------------------------------------------------------------------------
// Prisma client singleton for the bot package.
//
// The bot and API run in the same process, but the API owns the entry point
// and loads dotenv before calling startBot(). By the time this module is
// imported, DATABASE_URL is already on process.env.
//
// We keep this separate from api/src/lib/prisma.ts to avoid a circular
// dependency (api → bot → api). Both singletons connect to the same database;
// Prisma's connection pool means this does not open a second physical socket.
//
// Prisma 7 requires a driver adapter for database connections.
// ---------------------------------------------------------------------------

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
