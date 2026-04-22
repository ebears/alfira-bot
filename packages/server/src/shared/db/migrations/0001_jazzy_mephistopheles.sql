CREATE TABLE `Tag` (
	`id` text PRIMARY KEY NOT NULL,
	`nameLower` text NOT NULL,
	`canonicalName` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Tag_nameLower_unique` ON `Tag` (`nameLower`);