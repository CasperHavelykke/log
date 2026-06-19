/**
 * Migration 0029: tilføj drink_sessions + drink_logs.
 * Idempotent — tjekker om tabellerne findes inden CREATE.
 *
 * Brug:
 *   Lokal: npx tsx scripts/migrate-drink-counter.ts
 *   Turso:
 *     $env:TURSO_DATABASE_URL = "libsql://..."
 *     $env:TURSO_AUTH_TOKEN = "..."
 *     npx tsx scripts/migrate-drink-counter.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  console.log(`Target: ${url.startsWith("file:") ? "lokal" : "Turso"}`);

  const existing = (
    await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('drink_sessions','drink_logs')",
    )
  ).rows.map((r) => r.name as string);

  if (existing.includes("drink_sessions")) {
    console.log("✓ drink_sessions findes allerede");
  } else {
    await client.execute(`
      CREATE TABLE drink_sessions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id integer NOT NULL,
        session_date text NOT NULL,
        started_at text NOT NULL,
        ended_at text,
        created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
      )
    `);
    await client.execute(
      `CREATE INDEX drink_sessions_user_started ON drink_sessions (user_id, started_at)`,
    );
    console.log("✓ drink_sessions oprettet");
  }

  if (existing.includes("drink_logs")) {
    console.log("✓ drink_logs findes allerede");
  } else {
    await client.execute(`
      CREATE TABLE drink_logs (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        session_id integer NOT NULL,
        unit_count integer NOT NULL,
        kind text NOT NULL,
        occurred_at text NOT NULL,
        FOREIGN KEY (session_id) REFERENCES drink_sessions(id) ON DELETE cascade
      )
    `);
    await client.execute(
      `CREATE INDEX drink_logs_session_occurred ON drink_logs (session_id, occurred_at)`,
    );
    console.log("✓ drink_logs oprettet");
  }

  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
