import { randomUUID } from 'node:crypto';
import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const song = sqliteTable('Song', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  title: text('title').notNull(),
  youtubeUrl: text('youtubeUrl').notNull().unique(),
  youtubeId: text('youtubeId').notNull().unique(),
  duration: integer('duration').notNull(),
  thumbnailUrl: text('thumbnailUrl').notNull(),
  addedBy: text('addedBy').notNull(),
  nickname: text('nickname'),
  artist: text('artist'),
  album: text('album'),
  artwork: text('artwork'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  volumeBoost: integer('volumeBoost'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const playlist = sqliteTable('Playlist', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  createdBy: text('createdBy').notNull(),
  isPrivate: integer('isPrivate', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const playlistSong = sqliteTable(
  'PlaylistSong',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    playlistId: text('playlistId').notNull(),
    songId: text('songId').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [
    unique().on(t.playlistId, t.songId),
    index('PlaylistSong_playlistId_position_idx').on(t.playlistId, t.position),
  ]
);

export const refreshToken = sqliteTable(
  'RefreshToken',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tokenHash: text('tokenHash').notNull().unique(),
    discordId: text('discordId').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('RefreshToken_discordId_idx').on(t.discordId)]
);

export const tag = sqliteTable('Tag', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  nameLower: text('nameLower').notNull().unique(),
  canonicalName: text('canonicalName').notNull(),
  color: text('color'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const guildSettings = sqliteTable('guildSettings', {
  id: integer('id').primaryKey(), // always 1 — single guild row
  compressorEnabled: integer('compressorEnabled', { mode: 'boolean' }).notNull().default(false),
  compressorThreshold: integer('compressorThreshold').notNull().default(-6), // dB, -60 to 0
  compressorRatio: real('compressorRatio').notNull().default(4.0), // 1.0 to 20.0
  compressorAttack: integer('compressorAttack').notNull().default(5), // ms, 0 to 100
  compressorRelease: integer('compressorRelease').notNull().default(50), // ms, 10 to 1000
  compressorGain: integer('compressorGain').notNull().default(3), // dB, 0 to 24
});
