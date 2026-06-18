"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function saveReflection(input: {
  date: string;
  workNotes: string | null;
  wentWell: string | null;
  nextStep: string | null;
}) {
  const user = await requireUser();
  if (!dateRegex.test(input.date)) {
    return { ok: false as const, error: "Ugyldig dato" };
  }

  const now = new Date().toISOString();
  const fields = {
    workNotes: input.workNotes?.trim() || null,
    wentWell: input.wentWell?.trim() || null,
    nextStep: input.nextStep?.trim() || null,
  };

  const existing = await db
    .select()
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, user.id),
        eq(schema.dayEntries.date, input.date),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.dayEntries)
      .set({ ...fields, updatedAt: now })
      .where(eq(schema.dayEntries.id, existing[0].id));
  } else {
    await db.insert(schema.dayEntries).values({
      userId: user.id,
      date: input.date,
      ...fields,
    });
  }

  revalidatePath("/projects");
  revalidatePath("/today");
  return { ok: true as const, savedAt: now };
}
