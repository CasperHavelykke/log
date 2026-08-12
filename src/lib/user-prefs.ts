"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

export type UserPrefs = {
  fasteEnabled: boolean;
  garminSleepEnabled: boolean;
  trainingEnabled: boolean;
};

export async function getUserPrefs(): Promise<UserPrefs> {
  const user = await requireUser();
  return {
    fasteEnabled: user.fasteEnabled ?? false,
    garminSleepEnabled: user.garminSleepEnabled ?? false,
    trainingEnabled: user.trainingEnabled ?? false,
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

export async function setTrainingEnabled(enabled: boolean) {
  const user = await requireUser();
  await db
    .update(schema.users)
    .set({ trainingEnabled: enabled })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/traening");
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function setGarminSleepEnabled(enabled: boolean) {
  const user = await requireUser();
  await db
    .update(schema.users)
    .set({ garminSleepEnabled: enabled })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/health");
  revalidatePath("/statistik");
  revalidatePath("/settings");
  return { ok: true as const };
}
