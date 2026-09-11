CREATE TABLE `plan_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`project_id` integer,
	`supplement_id` integer,
	`workout_template_id` integer,
	`label` text,
	`schedule_type` text NOT NULL,
	`weekdays` text,
	`interval_days` integer,
	`anchor_date` text,
	`time_of_day` text,
	`minutes_planned` integer,
	`kcal_target` integer,
	`carbs_target_g` integer,
	`protein_target_g` integer,
	`fat_target_g` integer,
	`fiber_target_g` integer,
	`paused` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workout_template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plan_items_user` ON `plan_items` (`user_id`);--> statement-breakpoint
CREATE TABLE `plan_marks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`plan_item_id` integer NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_item_id`) REFERENCES `plan_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_marks_item_date` ON `plan_marks` (`plan_item_id`,`date`);