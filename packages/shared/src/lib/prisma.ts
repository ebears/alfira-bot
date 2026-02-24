import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma client singleton
//
// Instantiating PrismaClient in every file that needs it would open a new
// database connection pool each time. We export a single shared instance
// instead. All routes import prisma from here.
// ---------------------------------------------------------------------------
const prisma = new PrismaClient();

export default prisma;
