/**
 * Print recovered photos (uden tracker) — så du kan tjekke hvad du har
 * og evt. tildele dem en tracker manuelt.
 *
 * Brug:
 *   $env:TURSO_DATABASE_URL = "..."
 *   $env:TURSO_AUTH_TOKEN = "..."
 *   $env:LIST_USER_ID = "1"
 *   npx tsx scripts/list-orphan-photos.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const userId = Number(process.env.LIST_USER_ID ?? "1");

  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const rows = await client.execute({
    sql: `SELECT id, caption, taken_at, blob_url, mime_type
          FROM photos
          WHERE user_id = ? AND tracker_id IS NULL
          ORDER BY taken_at DESC`,
    args: [userId],
  });

  console.log(`${rows.rows.length} orphan photos:\n`);
  for (const r of rows.rows) {
    console.log(`id=${r.id}  taken_at=${r.taken_at}  ${r.caption}`);
    console.log(`  ${r.blob_url}\n`);
  }
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
