/**
 * Kør ventende drizzle-migrationer mod DATABASE_URL (default: lokal
 * data/app.db). Erstatter `drizzle-kit migrate`, som fejler stille på
 * denne maskine. Bruges også på serveren ved deploy:
 *   npx tsx scripts/apply-migrations.ts
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const client = createClient({ url });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrationer anvendt OK mod", url);
}

main().catch((err) => {
  console.error("Migration fejlede:");
  console.error(err);
  process.exit(1);
});
