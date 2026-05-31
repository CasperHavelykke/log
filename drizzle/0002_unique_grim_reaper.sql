CREATE TABLE `application_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`application_id` integer NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `job_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `application_events_application` ON `application_events` (`application_id`);--> statement-breakpoint
CREATE INDEX `application_events_user` ON `application_events` (`user_id`);--> statement-breakpoint
INSERT INTO `application_events` (`user_id`, `application_id`, `status`, `occurred_at`, `created_at`)
SELECT `user_id`, `id`, `status`, COALESCE(`sent_at`, date(`created_at`), date('now')), `created_at`
FROM `job_applications`;