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
// ---------------------------------------------------------------------------

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
