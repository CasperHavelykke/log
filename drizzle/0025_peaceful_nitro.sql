DROP TABLE `sessions`;--> statement-breakpoint
DROP INDEX `users_username_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `password_hash`;