"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { hashClientSecret, randomToken } from "@/lib/oauth";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  redirectUris: z
    .array(z.string().url())
    .min(1, "Mindst én redirect URI er påkrævet")
    .max(10),
});

export type CreateResult =
  | {
      ok: true;
      clientId: string;
      clientSecret: string;
      name: string;
    }
  | { ok: false; error: string };

export async function createOAuthClient(input: {
  name: string;
  redirectUris: string[];
}): Promise<CreateResult> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }

  const clientId = `log-${randomToken(8)}`;
  const clientSecret = randomToken(32);
  const clientSecretHash = await hashClientSecret(clientSecret);

  await db.insert(schema.oauthClients).values({
    userId: user.id,
    clientId,
    clientSecretHash,
    name: parsed.data.name.trim(),
    redirectUris: JSON.stringify(parsed.data.redirectUris),
  });

  revalidatePath("/settings");
  return {
    ok: true,
    clientId,
    clientSecret,
    name: parsed.data.name.trim(),
  };
}

export async function listOAuthClients() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: schema.oauthClients.id,
      clientId: schema.oauthClients.clientId,
      name: schema.oauthClients.name,
      redirectUris: schema.oauthClients.redirectUris,
      createdAt: schema.oauthClients.createdAt,
    })
    .from(schema.oauthClients)
    .where(eq(schema.oauthClients.userId, user.id))
    .orderBy(asc(schema.oauthClients.createdAt));
  return rows;
}

export async function deleteOAuthClient(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.oauthClients)
    .where(
      and(
        eq(schema.oauthClients.id, id),
        eq(schema.oauthClients.userId, user.id),
      ),
    );
  revalidatePath("/settings");
  return { ok: true as const };
}
