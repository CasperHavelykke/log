ALTER TABLE `recipes` ADD `share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_share_token` ON `recipes` (`share_token`);--> statement-breakpoint
ALTER TABLE `users` ADD `recipes_share_token` text;