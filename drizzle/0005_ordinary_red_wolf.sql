PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_week_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`week_start` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`applications_target` integer,
	`focus_hours_target_x10` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_week_goals`("id", "user_id", "week_start", "text", "applications_target", "focus_hours_target_x10", "created_at", "updated_at") SELECT "id", "user_id", "week_start", "text", NULL, NULL, "created_at", "updated_at" FROM `week_goals`;--> statement-breakpoint
DROP TABLE `week_goals`;--> statement-breakpoint
ALTER TABLE `__new_week_goals` RENAME TO `week_goals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `week_goals_user_week` ON `week_goals` (`user_id`,`week_start`);