/**
 * Engangs-fix: truncate ISO-timestamps på photos.taken_at + documents.created_at
 * til YYYY-MM-DD (recover-blobs.ts gemte fulde ISO-strings — schema forventer
 * kun dato-delen).
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const res = await client.execute(
    `UPDATE photos SET taken_at = substr(taken_at, 1, 10) WHERE length(taken_at) > 10`,
  );
  console.log(`✓ Photos opdateret: ${res.rowsAffected ?? "?"} rækker`);

  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
