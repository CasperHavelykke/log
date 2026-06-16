import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";

type Context = { userId: number };

const ctx = new AsyncLocalStorage<Context>();

export function runWithUser<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  return ctx.run({ userId }, fn);
}

export async function getActiveUser() {
  const store = ctx.getStore();
  if (!store) {
    throw new Error(
      "MCP-tool kaldt uden user-kontekst. Tokenet er sandsynligvis ugyldigt.",
    );
  }
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, store.userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    throw new Error(`Bruger ${store.userId} findes ikke længere.`);
  }
  return user;
}
