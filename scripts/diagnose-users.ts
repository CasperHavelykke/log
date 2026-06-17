/**
 * Diagnostik: vis hvilke brugere der findes, deres email, og hvor meget
 * data de har — så vi kan se om der er duplikater.
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const users = await client.execute(
    "SELECT id, email, name, created_at FROM users ORDER BY id",
  );
  console.log(`Fundet ${users.rows.length} bruger(e):\n`);

  for (const u of users.rows) {
    const id = Number(u.id);
    console.log(`Bruger id=${id}`);
    console.log(`  email:      ${u.email}`);
    console.log(`  name:       ${u.name}`);
    console.log(`  created_at: ${u.created_at}`);

    // Tæl data-rækker for denne bruger
    const counts: Record<string, number> = {};
    for (const table of [
      "day_entries",
      "projects",
      "time_entries",
      "job_applications",
      "sleep_entries",
      "fasts",
      "supplements",
      "supplement_intakes",
      "custom_parameters",
      "custom_parameter_values",
      "documents",
      "photos",
      "trackers",
      "accounts",
      "auth_sessions",
      "oauth_clients",
    ]) {
      const r = await client.execute({
        sql: `SELECT COUNT(*) as c FROM ${table} WHERE user_id = ?`,
        args: [id],
      });
      counts[table] = Number(r.rows[0]?.c ?? 0);
    }
    const nonZero = Object.entries(counts).filter(([, c]) => c > 0);
    if (nonZero.length === 0) {
      console.log("  data:       (ingen)");
    } else {
      console.log(`  data:`);
      for (const [t, c] of nonZero) {
        console.log(`    ${t}: ${c}`);
      }
    }
    console.log();
  }

  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
