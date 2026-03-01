import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// Prisma client singleton
//
// Instantiating PrismaClient in every file that needs it would open a new
// database connection pool each time. We export a single shared instance
// instead. All routes import prisma from here.
//
// Prisma 7 requires a driver adapter for database connections.
//
// NOTE: In Prisma 7, the client is generated to src/generated/prisma.
// This path works in both development and production Docker containers
// because the Dockerfile copies the generated client to the same location.
// ---------------------------------------------------------------------------

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export default prisma;

// Re-export PrismaClient and Prisma types for use in other packages
// This allows the bot package to import from @discord-music-bot/api/prisma
export { PrismaClient } from '../generated/prisma/client';
export type { Prisma } from '../generated/prisma/client';
