CREATE TABLE `drink_sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `session_date` text NOT NULL,
  `started_at` text NOT NULL,
  `ended_at` text,
  `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `drink_sessions_user_started` ON `drink_sessions` (`user_id`, `started_at`);

CREATE TABLE `drink_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` integer NOT NULL,
  `unit_count` integer NOT NULL,
  `kind` text NOT NULL,
  `occurred_at` text NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `drink_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `drink_logs_session_occurred` ON `drink_logs` (`session_id`, `occurred_at`);
