import { randomUUID } from 'node:crypto';
import { boolean, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const song = pgTable('Song', {
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
  tags: text('tags').array().default([]).notNull(),
  volumeOffset: integer('volumeOffset'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const playlist = pgTable('Playlist', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  createdBy: text('createdBy').notNull(),
  isPrivate: boolean('isPrivate').default(false).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const playlistSong = pgTable(
  'PlaylistSong',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    playlistId: text('playlistId').notNull(),
    songId: text('songId').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [unique().on(t.playlistId, t.songId), index().on(t.playlistId, t.position)]
);

export const refreshToken = pgTable(
  'RefreshToken',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tokenHash: text('tokenHash').notNull().unique(),
    discordId: text('discordId').notNull(),
    expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [index().on(t.discordId)]
);
