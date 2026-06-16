CREATE TABLE `accounts` (
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
DROP INDEX "accounts_user";--> statement-breakpoint
DROP INDEX "application_events_application";--> statement-breakpoint
DROP INDEX "application_events_user";--> statement-breakpoint
DROP INDEX "custom_parameter_values_uniq";--> statement-breakpoint
DROP INDEX "custom_parameter_values_date";--> statement-breakpoint
DROP INDEX "custom_parameters_user";--> statement-breakpoint
DROP INDEX "day_entries_user_date";--> statement-breakpoint
DROP INDEX "documents_user_kind";--> statement-breakpoint
DROP INDEX "documents_job_app";--> statement-breakpoint
DROP INDEX "fasts_user_started";--> statement-breakpoint
DROP INDEX "oauth_clients_client_id_unique";--> statement-breakpoint
DROP INDEX "photos_user_taken";--> statement-breakpoint
DROP INDEX "photos_tracker";--> statement-breakpoint
DROP INDEX "sleep_entries_user_date";--> statement-breakpoint
DROP INDEX "supplement_intakes_user_date";--> statement-breakpoint
DROP INDEX "supplement_intakes_name";--> statement-breakpoint
DROP INDEX "time_entries_user_project_date";--> statement-breakpoint
DROP INDEX "trackers_user_archived";--> statement-breakpoint
DROP INDEX "users_username_unique";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
DROP INDEX "week_goals_user_week";--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "username" TO "username" text;--> statement-breakpoint
CREATE INDEX `application_events_application` ON `application_events` (`application_id`);--> statement-breakpoint
CREATE INDEX `application_events_user` ON `application_events` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_parameter_values_uniq` ON `custom_parameter_values` (`user_id`,`parameter_id`,`date`);--> statement-breakpoint
CREATE INDEX `custom_parameter_values_date` ON `custom_parameter_values` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `custom_parameters_user` ON `custom_parameters` (`user_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `day_entries_user_date` ON `day_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `documents_user_kind` ON `documents` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `documents_job_app` ON `documents` (`job_application_id`);--> statement-breakpoint
CREATE INDEX `fasts_user_started` ON `fasts` (`user_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_clients_client_id_unique` ON `oauth_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `photos_user_taken` ON `photos` (`user_id`,`taken_at`);--> statement-breakpoint
CREATE INDEX `photos_tracker` ON `photos` (`tracker_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sleep_entries_user_date` ON `sleep_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `supplement_intakes_user_date` ON `supplement_intakes` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `supplement_intakes_name` ON `supplement_intakes` (`user_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `time_entries_user_project_date` ON `time_entries` (`user_id`,`project_id`,`date`);--> statement-breakpoint
CREATE INDEX `trackers_user_archived` ON `trackers` (`user_id`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `week_goals_user_week` ON `week_goals` (`user_id`,`week_start`);--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "password_hash" TO "password_hash" text;--> statement-breakpoint
ALTER TABLE `users` ADD `email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `image` text;