CREATE TABLE `custom_parameter_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`parameter_id` integer NOT NULL,
	`date` text NOT NULL,
	`value_bool` integer,
	`value_int` integer,
	`value_real` real,
	`value_text` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parameter_id`) REFERENCES `custom_parameters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_parameter_values_uniq` ON `custom_parameter_values` (`user_id`,`parameter_id`,`date`);--> statement-breakpoint
CREATE INDEX `custom_parameter_values_date` ON `custom_parameter_values` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `custom_parameters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`unit` text,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_parameters_user` ON `custom_parameters` (`user_id`,`archived`);