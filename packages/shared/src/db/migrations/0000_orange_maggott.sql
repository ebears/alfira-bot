CREATE TABLE `Playlist` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdBy` text NOT NULL,
	`isPrivate` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `PlaylistSong` (
	`id` text PRIMARY KEY NOT NULL,
	`playlistId` text NOT NULL,
	`songId` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `PlaylistSong_playlistId_position_idx` ON `PlaylistSong` (`playlistId`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `PlaylistSong_playlistId_songId_unique` ON `PlaylistSong` (`playlistId`,`songId`);--> statement-breakpoint
CREATE TABLE `RefreshToken` (
	`id` text PRIMARY KEY NOT NULL,
	`tokenHash` text NOT NULL,
	`discordId` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RefreshToken_tokenHash_unique` ON `RefreshToken` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `RefreshToken_discordId_idx` ON `RefreshToken` (`discordId`);--> statement-breakpoint
CREATE TABLE `Song` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`youtubeUrl` text NOT NULL,
	`youtubeId` text NOT NULL,
	`duration` integer NOT NULL,
	`thumbnailUrl` text NOT NULL,
	`addedBy` text NOT NULL,
	`nickname` text,
	`artist` text,
	`album` text,
	`artwork` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`volumeOffset` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Song_youtubeUrl_unique` ON `Song` (`youtubeUrl`);--> statement-breakpoint
CREATE UNIQUE INDEX `Song_youtubeId_unique` ON `Song` (`youtubeId`);