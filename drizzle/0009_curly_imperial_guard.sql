ALTER TABLE `day_entries` ADD `did_fast` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `day_entries` ADD `fast_hours_x10` integer;--> statement-breakpoint
ALTER TABLE `day_entries` ADD `fast_break_time` text;