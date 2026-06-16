import "server-only";

import { redirect } from "next/navigation";
import { eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth, signOut } from "@/auth";

// Henter den fulde user-row fra DB ud fra Auth.js' session. Kald-stederne
// regner med fuld user-shape (id, name, email, focusProjectId osv.), så vi
// laver én lookup per request — billig sammenlignet med resten af siden.
export async function getCurrentUser() {
  const session = await auth();
  const idRaw = session?.user?.id;
  if (!idRaw) return null;
  const id = typeof idRaw === "string" ? Number(idRaw) : idRaw;
  if (!Number.isFinite(id)) return null;

  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id as number))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession() {
  await signOut({ redirect: false });
}

// Behold som no-op for at undgå at brække scripts. Auth.js' adapter rydder
// expired sessions selv.
export async function pruneExpiredSessions() {
  await db
    .delete(schema.authSessions)
    .where(lt(schema.authSessions.expires, new Date()));
}
