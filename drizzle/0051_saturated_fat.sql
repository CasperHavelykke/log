ALTER TABLE `day_entries` ADD `saturated_fat_g` integer;--> statement-breakpoint
ALTER TABLE `plan_items` ADD `saturated_fat_target_g` integer;--> statement-breakpoint
ALTER TABLE `plan_items` ADD `saturated_fat_max_g` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `saturated_fat_g` integer;