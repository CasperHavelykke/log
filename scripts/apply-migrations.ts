/**
 * Kør ventende drizzle-migrationer mod DATABASE_URL (default: lokal
 * data/app.db). Erstatter `drizzle-kit migrate`, som fejler stille på
 * Windows-devmaskinen.
 *
 * Brug:
 *   npx tsx scripts/apply-migrations.ts
 *
 * Backfill (engangsreparation af bogførings-drift): hvis databasen
 * allerede HAR skemaændringerne fra migration N og bagud (fx fordi de
 * blev anvendt via ad-hoc scripts), men __drizzle_migrations ikke ved
 * det, så registrér dem som anvendt uden at køre dem:
 *   npx tsx scripts/apply-migrations.ts --backfill-through 27
 * Derefter anvendes resten (fx 0028) normalt.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

type JournalEntry = { idx: number; when: number; tag: string };

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const client = createClient({ url });

  const flagIdx = process.argv.indexOf("--backfill-through");
  if (flagIdx !== -1) {
    const through = Number(process.argv[flagIdx + 1]);
    if (!Number.isInteger(through)) {
      throw new Error("--backfill-through kræver et migrations-indeks, fx 27");
    }
    const journal = JSON.parse(
      readFileSync("./drizzle/meta/_journal.json", "utf8"),
    ) as { entries: JournalEntry[] };

    await client.execute(
      `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      )`,
    );

    for (const entry of journal.entries.filter((e) => e.idx <= through)) {
      const sql = readFileSync(`./drizzle/${entry.tag}.sql`, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const existing = await client.execute({
        sql: "SELECT COUNT(*) AS c FROM __drizzle_migrations WHERE hash = ? OR created_at = ?",
        args: [hash, entry.when],
      });
      const count = Number(existing.rows[0].c);
      if (count === 0) {
        await client.execute({
          sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
          args: [hash, entry.when],
        });
        console.log("Backfillet (registreret uden at køre):", entry.tag);
      }
    }
  }

  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrationer anvendt OK mod", url);
}

main().catch((err) => {
  console.error("Migration fejlede:");
  console.error(err);
  process.exit(1);
});
