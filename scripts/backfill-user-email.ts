/**
 * Sætter email på en eksisterende bruger så Auth.js linker magic-link-login
 * til den i stedet for at oprette en ny user-row.
 *
 * Brug:
 *   $env:DATABASE_URL = "libsql://..."
 *   $env:DATABASE_AUTH_TOKEN = "..."
 *   $env:BACKFILL_USER_ID = "1"
 *   $env:BACKFILL_EMAIL = "bruger@example.com"
 *   npx tsx scripts/backfill-user-email.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const userIdRaw = process.env.BACKFILL_USER_ID;
  const email = process.env.BACKFILL_EMAIL;

  if (!userIdRaw || !email) {
    console.error("Sæt BACKFILL_USER_ID og BACKFILL_EMAIL");
    process.exit(1);
  }
  const userId = Number(userIdRaw);
  if (!Number.isFinite(userId)) {
    console.error("BACKFILL_USER_ID skal være et tal");
    process.exit(1);
  }

  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const before = await client.execute({
    sql: "SELECT id, username, email FROM users WHERE id = ?",
    args: [userId],
  });
  if (before.rows.length === 0) {
    console.error(`Bruger id=${userId} findes ikke.`);
    process.exit(1);
  }
  console.log("Før:", before.rows[0]);

  await client.execute({
    sql: "UPDATE users SET email = ? WHERE id = ?",
    args: [email, userId],
  });

  const after = await client.execute({
    sql: "SELECT id, username, email FROM users WHERE id = ?",
    args: [userId],
  });
  console.log("Efter:", after.rows[0]);
  console.log("\n✓ Email backfilled.");
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
