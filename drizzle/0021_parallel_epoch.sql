CREATE TABLE `trackers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trackers_user_archived` ON `trackers` (`user_id`,`archived`);--> statement-breakpoint
ALTER TABLE `photos` ADD `tracker_id` integer REFERENCES trackers(id);--> statement-breakpoint
CREATE INDEX `photos_tracker` ON `photos` (`tracker_id`);--> statement-breakpoint
INSERT INTO trackers (user_id, name, kind)
SELECT DISTINCT
  user_id,
  COALESCE(body_area, '(uden navn)') AS name,
  CASE category
    WHEN 'skin_spot' THEN 'skin_spot'
    WHEN 'body_progress' THEN 'other'
    ELSE 'other'
  END AS kind
FROM photos
WHERE tracker_id IS NULL;--> statement-breakpoint
UPDATE photos
SET tracker_id = (
  SELECT t.id FROM trackers t
  WHERE t.user_id = photos.user_id
    AND t.name = COALESCE(photos.body_area, '(uden navn)')
    AND t.kind = CASE photos.category
      WHEN 'skin_spot' THEN 'skin_spot'
      WHEN 'body_progress' THEN 'other'
      ELSE 'other'
    END
)
WHERE tracker_id IS NULL;