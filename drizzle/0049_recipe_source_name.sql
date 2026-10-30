ALTER TABLE `recipes` ADD `source_name` text;--> statement-breakpoint
UPDATE `recipes` SET `source_name` = `source_url`, `source_url` = NULL WHERE `source_url` IS NOT NULL AND `source_url` NOT LIKE 'http://%' AND `source_url` NOT LIKE 'https://%';
