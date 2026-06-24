/**
 * Drop de 11 hardcoded helbreds-kolonner fra day_entries efter at koden er
 * deployed der ikke længere refererer dem, og efter at data er migreret
 * via migrate-health-fields-to-presets.ts.
 *
 * Kolonner der droppes:
 *   headache, headache_intensity
 *   constipation, constipation_pain
 *   iskias_pain
 *   seborrheic_dermatitis
 *   staph
 *   breathing_difficulty, breathing_context
 *   foamy_urine, foamy_urine_pattern
 *
 * KRITISK: bruger PRAGMA foreign_keys = OFF for at undgå cascade-delete.
 *
 * Brug:
 *   $env:DATABASE_URL = "libsql://..."
 *   $env:DATABASE_AUTH_TOKEN = "..."
 *   npx tsx scripts/drop-health-columns.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const isLocal = url.startsWith("file:");
  console.log(`Target: ${isLocal ? "lokal SQLite" : "Turso"}`);

  const cols = (
    await client.execute("PRAGMA table_info(day_entries)")
  ).rows.map((r) => r.name as string);

  const TO_DROP = [
    "headache",
    "headache_intensity",
    "constipation",
    "constipation_pain",
    "iskias_pain",
    "seborrheic_dermatitis",
    "staph",
    "breathing_difficulty",
    "breathing_context",
    "foamy_urine",
    "foamy_urine_pattern",
  ];

  const present = TO_DROP.filter((c) => cols.includes(c));
  if (present.length === 0) {
    console.log("✓ Ingen af kolonnerne findes længere — intet at gøre.");
    client.close();
    return;
  }
  console.log(`Kolonner at droppe: ${present.join(", ")}`);

  await client.execute("PRAGMA foreign_keys = OFF");
  const tx = await client.transaction("write");
  try {
    for (const col of present) {
      await tx.execute(`ALTER TABLE day_entries DROP COLUMN ${col}`);
      console.log(`  ✓ droppet: ${col}`);
    }
    await tx.commit();
  } catch (e) {
    console.error("Fejl:", e);
    try { await tx.rollback(); } catch {}
    throw e;
  }
  await client.execute("PRAGMA foreign_keys = ON");

  const finalCols = (
    await client.execute("PRAGMA table_info(day_entries)")
  ).rows.map((r) => r.name as string);
  console.log(`\nFinal day_entries-kolonner (${finalCols.length}):`);
  console.log("  " + finalCols.join(", "));

  console.log("\n✓ Færdig.");
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
