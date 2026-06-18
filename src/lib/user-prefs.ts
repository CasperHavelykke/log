"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

export type UserPrefs = {
  fasteEnabled: boolean;
};

export async function getUserPrefs(): Promise<UserPrefs> {
  const user = await requireUser();
  return {
    fasteEnabled: user.fasteEnabled ?? false,
  };
}

export async function setFasteEnabled(enabled: boolean) {
  const user = await requireUser();
  await db
    .update(schema.users)
    .set({ fasteEnabled: enabled })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/health");
  return { ok: true as const };
}
