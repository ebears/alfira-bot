import { defineConfig } from 'drizzle-kit';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export default defineConfig({
  schema: './packages/shared/src/db/schema.ts',
  out: './packages/shared/src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
});
