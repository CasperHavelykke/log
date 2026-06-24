import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

// libsql understøtter både lokal SQLite-fil ("file:./data/app.db") og remote
// Turso ("libsql://...turso.io" + authToken). Vi bruger samme driver overalt;
// URL'en bestemmer mode. Default: lokal fil for backwards-kompatibilitet.
function resolveUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;
  const localPath =
    process.env.DATABASE_PATH ?? resolve(process.cwd(), "data", "app.db");
  mkdirSync(dirname(localPath), { recursive: true });
  return `file:${localPath}`;
}

const globalForDb = globalThis as unknown as {
  __libsqlClient?: Client;
};

function openClient(): Client {
  const url = resolveUrl();
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  return createClient(url.startsWith("file:") ? { url } : { url, authToken });
}

const client = globalForDb.__libsqlClient ?? openClient();
if (process.env.NODE_ENV !== "production") globalForDb.__libsqlClient = client;

export const db = drizzle(client, { schema });
export { schema };
