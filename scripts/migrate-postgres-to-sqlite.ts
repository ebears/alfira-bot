#!/usr/bin/env bun

/**
 * One-time data migration: PostgreSQL → SQLite
 *
 * Reads all data from a running PostgreSQL database and writes it to a new
 * SQLite database file. Safe to run multiple times — it creates fresh tables
 * each run.
 *
 * Usage:
 *   # From the project root with Docker running the old Postgres-based stack:
 *   POSTGRES_URL="postgresql://botuser:botpass@localhost:5432/musicbot" \
 *   SQLITE_PATH=/tmp/alfira-migration.db \
 *   bun scripts/migrate-postgres-to-sqlite.ts
 *
 * Production migration procedure:
 *   1. Pull the new image (while the old compose is still running):
 *      docker pull ghcr.io/ebears/alfira:latest
 *
 *   2. Create the data directory on the host:
 *      mkdir -p /var/alfira-data
 *
 *   3. Run this script inside the new container:
 *      docker run --rm \
 *        --network alfira_default \
 *        -e POSTGRES_URL="postgresql://botuser:botpass@db:5432/musicbot" \
 *        -e SQLITE_PATH=/data/alfira.db \
 *        -v /var/alfira-data:/data \
 *        ghcr.io/ebears/alfira:latest \
 *        bun scripts/migrate-postgres-to-sqlite.ts
 *
 *   4. Verify row counts match between Postgres and SQLite
 *   5. Update .env: set DATABASE_URL=/data/alfira.db; remove POSTGRES_* vars
 *   6. docker compose -f docker-compose.prod.yml down
 *   7. docker compose -f docker-compose.prod.yml up -d
 */

import { Database } from 'bun:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../packages/shared/dist/db/migrations');

// ---------------------------------------------------------------------------
// Validate env
// ---------------------------------------------------------------------------
const POSTGRES_URL = process.env.POSTGRES_URL;
const SQLITE_PATH = process.env.SQLITE_PATH ?? './alfira.db';

if (!POSTGRES_URL) {
  console.error('POSTGRES_URL environment variable is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Open connections
// ---------------------------------------------------------------------------
console.log('Connecting to PostgreSQL...');
const pg = postgres(POSTGRES_URL, { prepare: false });

console.log('Opening SQLite database...');
const sqlite = new Database(SQLITE_PATH, { create: true });
sqlite.exec('PRAGMA journal_mode=WAL;');
sqlite.exec('PRAGMA foreign_keys=ON;');

// ---------------------------------------------------------------------------
// Run migrations to create tables
// ---------------------------------------------------------------------------
console.log('Creating SQLite tables...');

sqlite.run(`
  CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const file of migrationFiles) {
  const filePath = join(MIGRATIONS_DIR, file);
  const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex');

  const existing = sqlite
    .query('SELECT hash FROM "__drizzle_migrations" WHERE hash = ?')
    .get(hash) as { hash: string } | undefined;
  if (existing) {
    console.log(`  Skipping ${file} (already applied)`);
    continue;
  }

  const rawSql = readFileSync(filePath, 'utf-8');
  const statements = rawSql.split(/-->\s*statement-breakpoint/);
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    try {
      sqlite.run(trimmed);
    } catch (err) {
      if ((err as Error).message.includes('already exists')) {
        continue;
      }
      throw err;
    }
  }

  sqlite.run(`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)`, [
    hash,
    Date.now(),
  ]);
  console.log(`  Applied ${file}`);
}

// ---------------------------------------------------------------------------
// Migrate data in dependency order
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

async function migrateTable<T extends Record<string, unknown>>(
  pgTable: string,
  sqliteTable: string,
  transform: (row: T) => Record<string, unknown>
): Promise<number> {
  console.log(`  Migrating ${pgTable}...`);
  const rows = await pg`SELECT * FROM ${pg(pgTable)}`;
  if (rows.length === 0) {
    console.log(`    (0 rows)`);
    return 0;
  }

  const stmt = sqlite.prepare(
    `INSERT INTO ${sqliteTable} (${Object.keys(rows[0]).join(',')}) VALUES (${Object.keys(rows[0])
      .map(() => '?')
      .join(',')})`
  );

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      const transformed = transform(row as T);
      const values = Object.values(transformed);
      try {
        stmt.run(values);
        inserted++;
      } catch (err) {
        console.error(`    Error inserting row:`, err);
      }
    }
  }
  console.log(`    ${inserted}/${rows.length} rows`);
  return inserted;
}

// Tables in dependency order:
// 1. Song (no FK deps)
// 2. Playlist (no FK deps)
// 3. PlaylistSong (depends on Song + Playlist)
// 4. RefreshToken (no FK deps)

let totalRows = 0;

totalRows += await migrateTable('Song', 'Song', (row) => ({
  id: row.id ?? randomUUID(),
  title: row.title,
  youtubeUrl: row.youtubeUrl,
  youtubeId: row.youtubeId,
  duration: row.duration,
  thumbnailUrl: row.thumbnailUrl,
  addedBy: row.addedBy,
  nickname: row.nickname ?? null,
  artist: row.artist ?? null,
  album: row.album ?? null,
  artwork: row.artwork ?? null,
  tags: typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags ?? []),
  volumeOffset: row.volumeOffset ?? null,
  createdAt: row.createdAt ? Number(new Date(row.createdAt)) : Date.now(),
}));

totalRows += await migrateTable('Playlist', 'Playlist', (row) => ({
  id: row.id ?? randomUUID(),
  name: row.name,
  createdBy: row.createdBy,
  isPrivate: row.isPrivate ?? false,
  createdAt: row.createdAt ? Number(new Date(row.createdAt)) : Date.now(),
}));

totalRows += await migrateTable('PlaylistSong', 'PlaylistSong', (row) => ({
  id: row.id ?? randomUUID(),
  playlistId: row.playlistId,
  songId: row.songId,
  position: row.position,
}));

totalRows += await migrateTable('RefreshToken', 'RefreshToken', (row) => ({
  id: row.id ?? randomUUID(),
  tokenHash: row.tokenHash,
  discordId: row.discordId,
  expiresAt: row.expiresAt ? Number(new Date(row.expiresAt)) : Date.now(),
  createdAt: row.createdAt ? Number(new Date(row.createdAt)) : Date.now(),
}));

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------
console.log('\nVerification (row counts):');

const pgCounts = await Promise.all([
  pg`SELECT count(*) as c FROM song`,
  pg`SELECT count(*) as c FROM playlist`,
  pg`SELECT count(*) as c FROM "PlaylistSong"`,
  pg`SELECT count(*) as c FROM "RefreshToken"`,
]);

const sqliteCounts = [
  sqlite.query('SELECT count(*) as c FROM Song').get() as { c: number },
  sqlite.query('SELECT count(*) as c FROM Playlist').get() as { c: number },
  sqlite.query('SELECT count(*) as c FROM PlaylistSong').get() as { c: number },
  sqlite.query('SELECT count(*) as c FROM RefreshToken').get() as { c: number },
];

const tableNames = ['Song', 'Playlist', 'PlaylistSong', 'RefreshToken'];
let allMatch = true;
for (let i = 0; i < tableNames.length; i++) {
  const pgCount = Number(pgCounts[i][0].c);
  const sqliteCount = sqliteCounts[i].c;
  const match = pgCount === sqliteCount;
  if (!match) allMatch = false;
  console.log(
    `  ${tableNames[i]}: Postgres=${pgCount}, SQLite=${sqliteCount} ${match ? '✓' : 'MISMATCH'}`
  );
}

if (!allMatch) {
  console.error(
    '\nWARNING: Row count mismatch detected. Review the data before using the SQLite database.'
  );
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
console.log('\nClosing connections...');
await pg.end();
sqlite.close();

console.log(`\nMigration complete. ${totalRows} total rows migrated.`);
console.log(`SQLite database: ${SQLITE_PATH}`);
process.exit(allMatch ? 0 : 1);
