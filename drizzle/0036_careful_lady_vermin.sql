ALTER TABLE `plan_items` ADD `dose_target_x100` integer;--> statement-breakpoint
ALTER TABLE `plan_items` ADD `dose_unit` text;--> statement-breakpoint
UPDATE `plan_items` SET
  `label` = COALESCE(`label`, (SELECT `name` FROM `supplements` WHERE `supplements`.`id` = `plan_items`.`supplement_id`)),
  `dose_target_x100` = (SELECT `default_dose_amount_x100` FROM `supplements` WHERE `supplements`.`id` = `plan_items`.`supplement_id`),
  `dose_unit` = (SELECT `default_dose_unit` FROM `supplements` WHERE `supplements`.`id` = `plan_items`.`supplement_id`),
  `supplement_id` = NULL
WHERE `kind` = 'supplement' AND `supplement_id` IS NOT NULL;