import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    ...(authToken ? { authToken } : {}),
  },
} satisfies Config;
