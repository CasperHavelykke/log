CREATE TABLE `supplement_intakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`supplement_id` integer NOT NULL,
	`date` text NOT NULL,
	`dose_amount_x100` integer,
	`dose_unit` text,
	`time_of_day` text,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supplement_intakes_user_date` ON `supplement_intakes` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `supplement_intakes_supplement` ON `supplement_intakes` (`supplement_id`);--> statement-breakpoint
CREATE TABLE `supplements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`default_dose_amount_x100` integer,
	`default_dose_unit` text,
	`default_time_of_day` text,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
