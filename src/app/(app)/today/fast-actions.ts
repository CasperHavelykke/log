"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

export async function startFast(input?: { note?: string | null }) {
  const user = await requireUser();

  // Hvis der allerede er en aktiv faste, returnér den i stedet for at
  // oprette en ny — undgår dubletter ved klik-spam.
  const open = await db
    .select()
    .from(schema.fasts)
    .where(
      and(eq(schema.fasts.userId, user.id), isNull(schema.fasts.endedAt)),
    )
    .limit(1);
  if (open[0]) {
    return { ok: true as const, fast: open[0], wasAlreadyActive: true };
  }

  const now = new Date().toISOString();
  const inserted = await db
    .insert(schema.fasts)
    .values({
      userId: user.id,
      startedAt: now,
      endedAt: null,
      note: input?.note ?? null,
    })
    .returning();
  revalidatePath("/today");
  return { ok: true as const, fast: inserted[0], wasAlreadyActive: false };
}

const endFastSchema = z.object({
  endedAt: z.string().datetime().optional(),
  note: z.string().max(2_000).nullable().optional(),
});

export async function endFast(input?: z.infer<typeof endFastSchema>) {
  const user = await requireUser();
  const parsed = endFastSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false as const, error: "Ugyldigt input" };
  }
  const open = await db
    .select()
    .from(schema.fasts)
    .where(
      and(eq(schema.fasts.userId, user.id), isNull(schema.fasts.endedAt)),
    )
    .limit(1);
  if (!open[0]) {
    return { ok: false as const, error: "Ingen aktiv faste at bryde." };
  }
  const endedAt = parsed.data.endedAt ?? new Date().toISOString();
  const endMs = new Date(endedAt).getTime();
  if (endMs <= new Date(open[0].startedAt).getTime()) {
    return {
      ok: false as const,
      error: "Slut-tidspunkt skal være efter start.",
    };
  }
  if (endMs > Date.now()) {
    return {
      ok: false as const,
      error: "Slut-tidspunkt kan ikke ligge i fremtiden.",
    };
  }
  const updated = await db
    .update(schema.fasts)
    .set({
      endedAt,
      note:
        parsed.data.note !== undefined ? parsed.data.note : open[0].note,
    })
    .where(eq(schema.fasts.id, open[0].id))
    .returning();
  revalidatePath("/today");
  return { ok: true as const, fast: updated[0] };
}

const updateFastSchema = z.object({
  id: z.number().int(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  note: z.string().max(2_000).nullable().optional(),
});

export async function updateFast(input: z.infer<typeof updateFastSchema>) {
  const user = await requireUser();
  const parsed = updateFastSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { id, ...changes } = parsed.data;
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (v !== undefined) fields[k] = v;
  }
  if (Object.keys(fields).length === 0) return { ok: true as const };
  await db
    .update(schema.fasts)
    .set(fields)
    .where(and(eq(schema.fasts.id, id), eq(schema.fasts.userId, user.id)));
  revalidatePath("/today");
  return { ok: true as const };
}

export async function deleteFast(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.fasts)
    .where(and(eq(schema.fasts.id, id), eq(schema.fasts.userId, user.id)));
  revalidatePath("/today");
  return { ok: true as const };
}
