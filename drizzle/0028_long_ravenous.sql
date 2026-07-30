CREATE TABLE IF NOT EXISTS `drink_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`unit_count` integer NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `drink_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `drink_logs_session_occurred` ON `drink_logs` (`session_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `drink_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`session_date` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `drink_sessions_user_started` ON `drink_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`ingredients` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '' NOT NULL,
	`servings` integer,
	`source_url` text,
	`carbs_g` integer,
	`protein_g` integer,
	`fat_g` integer,
	`image_pathname` text,
	`image_mime` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recipes_user` ON `recipes` (`user_id`);