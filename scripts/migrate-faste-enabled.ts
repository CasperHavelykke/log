/**
 * Migration 0027: tilføj faste_enabled-kolonne til users.
 * Idempotent — bruger ALTER TABLE ... ADD COLUMN som SQLite kun kører
 * hvis kolonnen ikke findes.
 *
 * Brug:
 *   Lokal: npx tsx scripts/migrate-faste-enabled.ts
 *   Turso:
 *     $env:DATABASE_URL = "libsql://..."
 *     $env:DATABASE_AUTH_TOKEN = "..."
 *     npx tsx scripts/migrate-faste-enabled.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  console.log(`Target: ${url.startsWith("file:") ? "lokal" : "Turso"}`);

  const cols = (
    await client.execute("PRAGMA table_info(users)")
  ).rows.map((r) => r.name as string);

  if (cols.includes("faste_enabled")) {
    console.log("✓ faste_enabled findes allerede");
  } else {
    await client.execute(
      `ALTER TABLE users ADD COLUMN faste_enabled integer DEFAULT 0 NOT NULL`,
    );
    console.log("✓ faste_enabled tilføjet");
  }

  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
