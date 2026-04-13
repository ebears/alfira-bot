import { defineConfig } from 'drizzle-kit';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export default defineConfig({
  schema: './packages/server/src/shared/db/schema.ts',
  out: './packages/server/src/shared/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: DATABASE_URL,
  },
});
