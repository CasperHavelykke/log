PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_supplement_intakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`supplement_id` integer,
	`date` text NOT NULL,
	`dose_amount_x100` integer,
	`dose_unit` text,
	`time_of_day` text,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_supplement_intakes`("id", "user_id", "name", "supplement_id", "date", "dose_amount_x100", "dose_unit", "time_of_day", "note", "created_at")
  SELECT si."id", si."user_id", COALESCE(s."name", '') AS "name", si."supplement_id", si."date", si."dose_amount_x100", si."dose_unit", si."time_of_day", si."note", si."created_at"
  FROM `supplement_intakes` si
  LEFT JOIN `supplements` s ON s."id" = si."supplement_id";--> statement-breakpoint
DROP TABLE `supplement_intakes`;--> statement-breakpoint
ALTER TABLE `__new_supplement_intakes` RENAME TO `supplement_intakes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `supplement_intakes_user_date` ON `supplement_intakes` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `supplement_intakes_name` ON `supplement_intakes` (`user_id`,`name`);