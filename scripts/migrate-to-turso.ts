/**
 * Engangs-migration: kopierer alle rows fra en lokal SQLite-fil til en Turso-DB.
 *
 * Forudsætning: Turso-DB'en skal allerede have schema migreret. Kør først:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:migrate
 *
 * Brug:
 *   SOURCE_URL=file:./data/app.db \
 *   TURSO_DATABASE_URL=libsql://...turso.io \
 *   TURSO_AUTH_TOKEN=... \
 *   tsx scripts/migrate-to-turso.ts
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const TABLES = [
  { name: "users", table: schema.users },
  { name: "projects", table: schema.projects },
  { name: "week_goals", table: schema.weekGoals },
  { name: "day_entries", table: schema.dayEntries },
  { name: "time_entries", table: schema.timeEntries },
  { name: "job_applications", table: schema.jobApplications },
  { name: "application_events", table: schema.applicationEvents },
  { name: "sleep_entries", table: schema.sleepEntries },
  { name: "fasts", table: schema.fasts },
  { name: "supplements", table: schema.supplements },
  { name: "supplement_intakes", table: schema.supplementIntakes },
] as const;

const BATCH_SIZE = 50;

async function main() {
  const sourceUrl = process.env.SOURCE_URL ?? "file:./data/app.db";
  const targetUrl = process.env.TURSO_DATABASE_URL;
  const targetToken = process.env.TURSO_AUTH_TOKEN;

  if (!targetUrl || !targetUrl.startsWith("libsql://")) {
    console.error(
      "TURSO_DATABASE_URL skal være sat til en libsql:// URL (ikke en lokal file:).",
    );
    process.exit(1);
  }
  if (!targetToken) {
    console.error("TURSO_AUTH_TOKEN skal være sat.");
    process.exit(1);
  }

  console.log(`Kilde:  ${sourceUrl}`);
  console.log(`Mål:    ${targetUrl}`);
  console.log("");

  const source = drizzle(createClient({ url: sourceUrl }), { schema });
  const target = drizzle(
    createClient({ url: targetUrl, authToken: targetToken }),
    { schema },
  );

  let totalRows = 0;
  for (const { name, table } of TABLES) {
    const rows = await source.select().from(table);
    if (rows.length === 0) {
      console.log(`  ${name.padEnd(22)} 0 rækker — sprunget over`);
      continue;
    }

    const existing = await target
      .select({ c: sql<number>`count(*)` })
      .from(table);
    const existingCount = Number(existing[0]?.c ?? 0);
    if (existingCount > 0) {
      console.error(
        `  ${name}: målet har allerede ${existingCount} rækker — afbryder for at undgå dubletter`,
      );
      process.exit(1);
    }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await target.insert(table).values(chunk as any);
    }
    totalRows += rows.length;
    console.log(`  ${name.padEnd(22)} ${rows.length} rækker → mål`);
  }

  console.log("");
  console.log(`Færdig. ${totalRows} rækker i alt migreret.`);
  console.log("");
  console.log("Næste skridt:");
  console.log("  1. Verificér i Turso shell: 'select count(*) from day_entries;'");
  console.log("  2. Test login + /today på Vercel-deploymentet");
  console.log("  3. Når alt virker: arkivér data/app.db lokalt");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
