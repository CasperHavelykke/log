import { asc } from "drizzle-orm";
import { db, schema } from "../db";

export async function getActiveUser() {
  const rows = await db
    .select()
    .from(schema.users)
    .orderBy(asc(schema.users.id))
    .limit(1);

  const user = rows[0];
  if (!user) {
    throw new Error(
      "Ingen bruger fundet i databasen. Kør 'npm run user:create' først.",
    );
  }
  return user;
}
