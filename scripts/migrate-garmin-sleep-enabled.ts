/**
 * Migration 0028: tilføj garmin_sleep_enabled-kolonne til users.
 * Idempotent — bruger PRAGMA table_info til at tjekke om kolonnen findes.
 *
 * Brug:
 *   Lokal: npx tsx scripts/migrate-garmin-sleep-enabled.ts
 *   Turso:
 *     $env:TURSO_DATABASE_URL = "libsql://..."
 *     $env:TURSO_AUTH_TOKEN = "..."
 *     npx tsx scripts/migrate-garmin-sleep-enabled.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  console.log(`Target: ${url.startsWith("file:") ? "lokal" : "Turso"}`);

  const cols = (
    await client.execute("PRAGMA table_info(users)")
  ).rows.map((r) => r.name as string);

  if (cols.includes("garmin_sleep_enabled")) {
    console.log("✓ garmin_sleep_enabled findes allerede");
  } else {
    await client.execute(
      `ALTER TABLE users ADD COLUMN garmin_sleep_enabled integer DEFAULT 0 NOT NULL`,
    );
    console.log("✓ garmin_sleep_enabled tilføjet");
  }

  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
