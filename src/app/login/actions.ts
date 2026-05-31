"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

const schema_login = z.object({
  username: z.string().min(1, "Brugernavn mangler"),
  password: z.string().min(1, "Adgangskode mangler"),
});

export type LoginState = { error?: string };

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema_login.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldigt input" };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `login:${ip}:${parsed.data.username}`;
  const limit = rateLimit(key, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return {
      error: `For mange forsøg. Prøv igen om ${Math.ceil(limit.retryAfterSec / 60)} minutter.`,
    };
  }

  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, parsed.data.username))
    .limit(1);

  const user = rows[0];
  if (!user) {
    await verifyPassword(parsed.data.password, "$2a$12$invalidinvalidinvalidinvaliuO");
    return { error: "Forkert brugernavn eller adgangskode" };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return { error: "Forkert brugernavn eller adgangskode" };

  resetRateLimit(key);
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
