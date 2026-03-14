import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../api/src/generated/prisma/client';

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
//
// NOTE: We import directly from the API's generated Prisma client using a
// relative path. This avoids the circular build dependency that would occur
// if we imported from @alfira-bot/api/prisma (which requires the API
// to be built first). The relative path works in both development and Docker
// production because the directory structure is preserved.
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
});

const prisma: PrismaClient = new PrismaClient({ adapter });

export default prisma;
