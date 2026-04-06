CREATE TABLE "Playlist" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdBy" text NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PlaylistSong" (
	"id" text PRIMARY KEY NOT NULL,
	"playlistId" text NOT NULL,
	"songId" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "PlaylistSong_playlistId_songId_unique" UNIQUE("playlistId","songId")
);
--> statement-breakpoint
CREATE TABLE "RefreshToken" (
	"id" text PRIMARY KEY NOT NULL,
	"tokenHash" text NOT NULL,
	"discordId" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "RefreshToken_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "Song" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"youtubeUrl" text NOT NULL,
	"youtubeId" text NOT NULL,
	"duration" integer NOT NULL,
	"thumbnailUrl" text NOT NULL,
	"addedBy" text NOT NULL,
	"nickname" text,
	"artist" text,
	"album" text,
	"artwork" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"volumeOffset" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Song_youtubeUrl_unique" UNIQUE("youtubeUrl"),
	CONSTRAINT "Song_youtubeId_unique" UNIQUE("youtubeId")
);
--> statement-breakpoint
CREATE INDEX "PlaylistSong_playlistId_position_index" ON "PlaylistSong" USING btree ("playlistId","position");--> statement-breakpoint
CREATE INDEX "RefreshToken_discordId_index" ON "RefreshToken" USING btree ("discordId");