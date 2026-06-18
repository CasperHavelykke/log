CREATE TABLE `job_search_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_search_periods_user` ON `job_search_periods` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `job_search_periods_active` ON `job_search_periods` (`user_id`,`ended_at`);--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `headache`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `headache_intensity`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `iskias_pain`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `constipation`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `constipation_pain`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `seborrheic_dermatitis`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `staph`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `breathing_difficulty`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `breathing_context`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `foamy_urine`;--> statement-breakpoint
ALTER TABLE `day_entries` DROP COLUMN `foamy_urine_pattern`;