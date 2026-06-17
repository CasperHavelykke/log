/**
 * Engangs-cleanup efter Auth.js-migration: dropper legacy felter på users
 * (username, password_hash) og legacy sessions-tabel.
 *
 * Først kopieres username over i name (hvor name er null) så vi ikke
 * mister display-navn.
 *
 * Sikker at køre flere gange — tjekker først om der er noget at rydde.
 *
 * Brug:
 *   Lokal:
 *     npx tsx scripts/cleanup-legacy-auth.ts
 *
 *   Turso:
 *     $env:TURSO_DATABASE_URL = "libsql://..."
 *     $env:TURSO_AUTH_TOKEN = "..."
 *     npx tsx scripts/cleanup-legacy-auth.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const isLocal = url.startsWith("file:");
  console.log(`Target: ${isLocal ? "lokal SQLite" : "Turso"}`);

  const userCols = (
    await client.execute("PRAGMA table_info(users)")
  ).rows.map((r) => r.name as string);

  const hasUsername = userCols.includes("username");
  const hasPasswordHash = userCols.includes("password_hash");

  // --- 1. Backfill name <- username hvor name er null ---
  if (hasUsername) {
    const before = await client.execute(
      "SELECT COUNT(*) as c FROM users WHERE name IS NULL AND username IS NOT NULL",
    );
    const count = Number(before.rows[0]?.c ?? 0);
    if (count > 0) {
      await client.execute(
        "UPDATE users SET name = username WHERE name IS NULL AND username IS NOT NULL",
      );
      console.log(`✓ Kopierede username → name for ${count} bruger(e)`);
    } else {
      console.log("✓ Ingen brugere mangler name");
    }
  }

  // --- 2. Rebuild users-tabel uden username + password_hash ---
  if (hasUsername || hasPasswordHash) {
    console.log("  rebuilding users uden legacy-felter...");
    await client.execute("DROP TABLE IF EXISTS users_new");

    // KRITISK: foreign_keys = OFF før DROP TABLE users — ellers fyrer
    // ON DELETE CASCADE og sletter ALT data der peger på users (day_entries,
    // projects, time_entries, photos, documents osv.). defer_foreign_keys
    // hjælper IKKE her — den udsætter constraint-checks, ikke cascade-actions.
    // Casper's data blev slettet på denne måde i juni 2026 før denne fix.
    await client.execute("PRAGMA foreign_keys = OFF");
    const tx = await client.transaction("write");
    try {
      await tx.execute(`
        CREATE TABLE users_new (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          email text,
          email_verified integer,
          name text,
          image text,
          focus_project_id integer,
          created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
        )
      `);
      await tx.execute(`
        INSERT INTO users_new (id, email, email_verified, name, image, focus_project_id, created_at)
        SELECT id, email, email_verified, name, image, focus_project_id, created_at FROM users
      `);
      await tx.execute("DROP TABLE users");
      await tx.execute("ALTER TABLE users_new RENAME TO users");
      await tx.execute(
        "CREATE UNIQUE INDEX users_email_unique ON users (email)",
      );
      await tx.commit();
      console.log("✓ users rebuilt — username + password_hash droppet");
    } catch (e) {
      console.error("Original fejl under rebuild:", e);
      try { await tx.rollback(); } catch {}
      throw e;
    }
    await client.execute("PRAGMA foreign_keys = ON");
  } else {
    console.log("✓ users har ingen legacy-felter at fjerne");
  }

  // --- 3. Drop legacy sessions-tabel ---
  const tableExists = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
  );
  if (tableExists.rows.length > 0) {
    await client.execute("DROP TABLE sessions");
    console.log("✓ Legacy sessions-tabel droppet");
  } else {
    console.log("✓ Legacy sessions-tabel allerede væk");
  }

  // --- 4. Final state ---
  const finalCols = (
    await client.execute("PRAGMA table_info(users)")
  ).rows.map((r) => r.name as string);
  console.log("\nFinal users-kolonner:", finalCols.join(", "));

  const users = await client.execute(
    "SELECT id, name, email FROM users ORDER BY id",
  );
  console.log("\nBrugere:");
  for (const u of users.rows) {
    console.log(`  id=${u.id}  name=${u.name ?? "(null)"}  email=${u.email ?? "(null)"}`);
  }

  console.log("\n✓ Færdig.");
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
