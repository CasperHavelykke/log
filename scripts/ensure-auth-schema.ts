/**
 * Idempotent migration der bringer auth-skemaet i orden mod en libSQL DB
 * (lokal file: eller libsql://-URL til Turso).
 *
 * Sikker at køre flere gange. Tilføjer kun det der mangler.
 *
 * Brug:
 *   Lokal:
 *     npx tsx scripts/ensure-auth-schema.ts
 *
 *   Turso (med Mullvad slået fra):
 *     $env:TURSO_DATABASE_URL = "libsql://..."
 *     $env:TURSO_AUTH_TOKEN = "..."
 *     npx tsx scripts/ensure-auth-schema.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const isLocal = url.startsWith("file:");
  console.log(`Target: ${isLocal ? "lokal SQLite" : "Turso"} (${url.slice(0, 50)}${url.length > 50 ? "..." : ""})`);

  // --- 1. Auth.js' nye tabeller ---
  await client.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      user_id integer NOT NULL,
      type text NOT NULL,
      provider text NOT NULL,
      provider_account_id text NOT NULL,
      refresh_token text,
      access_token text,
      expires_at integer,
      token_type text,
      scope text,
      id_token text,
      session_state text,
      PRIMARY KEY(provider, provider_account_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
    )
  `);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS accounts_user ON accounts (user_id)`,
  );
  await client.execute(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_token text PRIMARY KEY NOT NULL,
      user_id integer NOT NULL,
      expires integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier text NOT NULL,
      token text NOT NULL,
      expires integer NOT NULL,
      PRIMARY KEY(identifier, token)
    )
  `);
  console.log("✓ accounts, auth_sessions, verification_tokens");

  // --- 2. Nye user-kolonner ---
  const colsRes = await client.execute("PRAGMA table_info(users)");
  const cols = colsRes.rows.map((r) => r.name as string);

  const addIfMissing = async (col: string, type: string) => {
    if (!cols.includes(col)) {
      await client.execute(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
      console.log(`  + ${col}`);
    }
  };
  await addIfMissing("email", "text");
  await addIfMissing("email_verified", "integer");
  await addIfMissing("name", "text");
  await addIfMissing("image", "text");

  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
  );
  console.log("✓ users.email / email_verified / name / image (+ unique index)");

  // --- 3. Drop NOT NULL fra username + password_hash via tabel-rebuild ---
  const colsFull = (
    await client.execute("PRAGMA table_info(users)")
  ).rows.map((r) => ({
    name: r.name as string,
    notnull: r.notnull as number,
  }));

  const usernameNotNull =
    colsFull.find((c) => c.name === "username")?.notnull === 1;
  const passwordNotNull =
    colsFull.find((c) => c.name === "password_hash")?.notnull === 1;

  if (usernameNotNull || passwordNotNull) {
    console.log("  rebuilding users-tabel for at fjerne NOT NULL...");

    // Ryd eventuel rest fra tidligere mislykket forsøg.
    await client.execute("DROP TABLE IF EXISTS users_new");

    // KRITISK: foreign_keys = OFF før DROP TABLE — ellers cascade-sletter
    // ON DELETE CASCADE alle child-rows. defer_foreign_keys hjælper IKKE.
    await client.execute("PRAGMA foreign_keys = OFF");
    const tx = await client.transaction("write");
    try {
      await tx.execute(`
        CREATE TABLE users_new (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          username text,
          password_hash text,
          focus_project_id integer,
          created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
          email text,
          email_verified integer,
          name text,
          image text
        )
      `);
      await tx.execute(`
        INSERT INTO users_new
          (id, username, password_hash, focus_project_id, created_at, email, email_verified, name, image)
        SELECT
          id, username, password_hash, focus_project_id, created_at, email, email_verified, name, image
        FROM users
      `);
      await tx.execute("DROP TABLE users");
      await tx.execute("ALTER TABLE users_new RENAME TO users");
      await tx.execute(
        "CREATE UNIQUE INDEX users_username_unique ON users (username)",
      );
      await tx.execute(
        "CREATE UNIQUE INDEX users_email_unique ON users (email)",
      );
      await tx.commit();
      console.log("✓ users rebuilt — username/password_hash er nu nullable");
    } catch (e) {
      console.error("Original fejl under rebuild:", e);
      try {
        await tx.rollback();
      } catch {
        // ignore — transaction allerede auto-aborted
      }
      throw e;
    }
    await client.execute("PRAGMA foreign_keys = ON");
  } else {
    console.log("✓ users.username + password_hash er allerede nullable");
  }

  // --- 4. Verificering ---
  const finalCols = (
    await client.execute("PRAGMA table_info(users)")
  ).rows.map((r) => ({
    name: r.name as string,
    notnull: r.notnull as number,
  }));
  console.log("\nFinal users-schema:");
  for (const c of finalCols) {
    console.log(`  ${c.name}${c.notnull ? " NOT NULL" : ""}`);
  }

  // --- 5. Vis eksisterende brugere så vi kan se hvilke der mangler email ---
  const users = await client.execute(
    "SELECT id, username, email FROM users ORDER BY id",
  );
  console.log("\nEksisterende brugere:");
  for (const u of users.rows) {
    console.log(
      `  id=${u.id}  username=${u.username ?? "(null)"}  email=${u.email ?? "(null)"}`,
    );
  }

  console.log("\n✓ Færdig.");
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
