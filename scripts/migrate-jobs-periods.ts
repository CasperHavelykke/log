/**
 * Anvender migration 0026 mod en libSQL DB (lokal eller Turso):
 *   - Opretter job_search_periods-tabel hvis den mangler
 *   - Dropper legacy helbreds-kolonner fra day_entries (try/catch hver
 *     for at undgå crash hvis nogen allerede er væk)
 *
 * Brug:
 *   Lokal: npx tsx scripts/migrate-jobs-periods.ts
 *   Turso:
 *     $env:DATABASE_URL = "libsql://..."
 *     $env:DATABASE_AUTH_TOKEN = "..."
 *     npx tsx scripts/migrate-jobs-periods.ts
 */
import { createClient } from "@libsql/client";

const LEGACY_COLUMNS = [
  "headache",
  "headache_intensity",
  "iskias_pain",
  "constipation",
  "constipation_pain",
  "seborrheic_dermatitis",
  "staph",
  "breathing_difficulty",
  "breathing_context",
  "foamy_urine",
  "foamy_urine_pattern",
];

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  console.log(`Target: ${url.startsWith("file:") ? "lokal" : "Turso"}`);

  // 1. Opret job_search_periods
  await client.execute(`
    CREATE TABLE IF NOT EXISTS job_search_periods (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id integer NOT NULL,
      name text,
      started_at text NOT NULL,
      ended_at text,
      created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
    )
  `);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS job_search_periods_user ON job_search_periods (user_id, started_at)`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS job_search_periods_active ON job_search_periods (user_id, ended_at)`,
  );
  console.log("✓ job_search_periods tabel + indekser");

  // 2. Drop legacy kolonner fra day_entries
  const cols = (
    await client.execute("PRAGMA table_info(day_entries)")
  ).rows.map((r) => r.name as string);

  let dropped = 0;
  for (const col of LEGACY_COLUMNS) {
    if (!cols.includes(col)) continue;
    try {
      await client.execute(`ALTER TABLE day_entries DROP COLUMN ${col}`);
      console.log(`  - ${col}`);
      dropped++;
    } catch (e) {
      console.error(`  ! kunne ikke droppe ${col}:`, (e as Error).message);
    }
  }
  if (dropped > 0) {
    console.log(`✓ Droppet ${dropped} legacy-kolonner fra day_entries`);
  } else {
    console.log("✓ Ingen legacy-kolonner at droppe");
  }

  console.log("\n✓ Færdig.");
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
