ALTER TABLE `drink_logs` ADD `units_x10` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: gamle rækker talte i hele genstande (unit_count).
UPDATE `drink_logs` SET `units_x10` = `unit_count` * 10 WHERE `units_x10` = 0;