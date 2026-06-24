/**
 * Engangs-migration: kopierer de 7 hardcoded helbreds-felter på day_entries
 * over i custom_parameter_values-systemet, så de kan slettes som kolonner
 * uden at miste historisk data.
 *
 * Idempotent — kan køres flere gange uden duplikater.
 *
 * For hver bruger:
 *   1. Tjekker om brugeren allerede har et custom_parameter med præsets navn
 *   2. Hvis ikke, opretter parameteret
 *   3. For hver day_entry med non-null værdi på det relevante felt:
 *      indsætter custom_parameter_values-række (eller skipper hvis findes)
 *
 * Brug:
 *   Lokal: npx tsx scripts/migrate-health-fields-to-presets.ts
 *   Turso:
 *     $env:DATABASE_URL = "libsql://..."
 *     $env:DATABASE_AUTH_TOKEN = "..."
 *     npx tsx scripts/migrate-health-fields-to-presets.ts
 */
import { createClient, type Client } from "@libsql/client";

type PresetSpec = {
  key: string;
  name: string;
  kind: string;
  // Hvilke day_entries-kolonner mapper til denne preset
  boolColumn?: string;
  intColumn?: string;
};

// Disse skal matche src/lib/parameter-presets.ts
const PRESETS: PresetSpec[] = [
  {
    key: "headache",
    name: "Hovedpine",
    kind: "bool_scale_10",
    boolColumn: "headache",
    intColumn: "headache_intensity",
  },
  {
    key: "constipation",
    name: "Forstoppelse",
    kind: "bool_scale_5",
    boolColumn: "constipation",
    intColumn: "constipation_pain",
  },
  {
    key: "iskias",
    name: "Iskias-smerte",
    kind: "scale_5",
    intColumn: "iskias_pain",
  },
  {
    key: "derm",
    name: "Skæleksem",
    kind: "scale_5",
    intColumn: "seborrheic_dermatitis",
  },
  {
    key: "staph",
    name: "Stafylokokker",
    kind: "scale_5",
    intColumn: "staph",
  },
  {
    key: "breathing",
    name: "Vejrtrækningsbesvær",
    kind: "scale_5",
    intColumn: "breathing_difficulty",
  },
  {
    key: "foamy_urine",
    name: "Skummende urin",
    kind: "boolean",
    boolColumn: "foamy_urine",
  },
];

async function getOrCreateParameter(
  client: Client,
  userId: number,
  preset: PresetSpec,
): Promise<number> {
  // Match by name + user
  const existing = await client.execute({
    sql: "SELECT id FROM custom_parameters WHERE user_id = ? AND name = ? LIMIT 1",
    args: [userId, preset.name],
  });
  if (existing.rows[0]) return Number(existing.rows[0].id);

  const inserted = await client.execute({
    sql: `INSERT INTO custom_parameters (user_id, name, kind, sort_order)
          VALUES (?, ?, ?, 0)
          RETURNING id`,
    args: [userId, preset.name, preset.kind],
  });
  return Number(inserted.rows[0]!.id);
}

async function migrateUser(client: Client, userId: number) {
  console.log(`\n--- Bruger ${userId} ---`);

  for (const preset of PRESETS) {
    const paramId = await getOrCreateParameter(client, userId, preset);

    // Byg WHERE-clause der kun rammer rækker hvor præsentationen har data
    const cols: string[] = [];
    if (preset.boolColumn) cols.push(preset.boolColumn);
    if (preset.intColumn) cols.push(preset.intColumn);
    const selectCols = ["date", ...cols].join(", ");

    // For bool_scale: tag kun rækker hvor bool=true OG int er sat
    // For scale: tag rækker hvor int IS NOT NULL og int > 0
    // For boolean: tag rækker hvor bool = 1 (true)
    let whereClause: string;
    if (preset.kind === "boolean") {
      whereClause = `${preset.boolColumn} = 1`;
    } else if (preset.kind === "bool_scale_5" || preset.kind === "bool_scale_10") {
      whereClause = `${preset.boolColumn} = 1 AND ${preset.intColumn} IS NOT NULL`;
    } else {
      // scale_5 / scale_10
      whereClause = `${preset.intColumn} IS NOT NULL`;
    }

    const rows = (
      await client.execute({
        sql: `SELECT ${selectCols}
              FROM day_entries
              WHERE user_id = ? AND ${whereClause}`,
        args: [userId],
      })
    ).rows;

    if (rows.length === 0) {
      console.log(`  ${preset.name}: ingen data at migrere`);
      continue;
    }

    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const date = row.date as string;

      // Tjek om der allerede er en værdi for denne dato
      const existsRes = await client.execute({
        sql: "SELECT id FROM custom_parameter_values WHERE user_id = ? AND parameter_id = ? AND date = ?",
        args: [userId, paramId, date],
      });
      if (existsRes.rows[0]) {
        skipped++;
        continue;
      }

      const valueBool = preset.boolColumn
        ? (row[preset.boolColumn] as number | null) === 1
          ? 1
          : 0
        : null;
      const valueInt = preset.intColumn
        ? (row[preset.intColumn] as number | null)
        : null;

      await client.execute({
        sql: `INSERT INTO custom_parameter_values
                (user_id, parameter_id, date, value_bool, value_int)
              VALUES (?, ?, ?, ?, ?)`,
        args: [userId, paramId, date, valueBool, valueInt],
      });
      created++;
    }
    console.log(
      `  ${preset.name}: ${created} oprettet${skipped > 0 ? `, ${skipped} sprunget over (eksisterede)` : ""}`,
    );
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  console.log(`Target: ${url.startsWith("file:") ? "lokal" : "Turso"}`);

  const users = await client.execute(
    "SELECT id FROM users ORDER BY id",
  );
  if (users.rows.length === 0) {
    console.log("Ingen brugere fundet.");
    return;
  }
  console.log(`Migrerer ${users.rows.length} bruger(e)`);

  for (const u of users.rows) {
    await migrateUser(client, Number(u.id));
  }

  console.log("\n✓ Færdig.");
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
