"use server";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { todayIsoDate } from "@/lib/date";

const startSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  startedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function startJobSearchPeriod(
  input: z.infer<typeof startSchema>,
) {
  const user = await requireUser();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }

  const today = todayIsoDate();

  // Luk eventuelt aktiv periode først så der altid kun er én aktiv.
  await db
    .update(schema.jobSearchPeriods)
    .set({ endedAt: today })
    .where(
      and(
        eq(schema.jobSearchPeriods.userId, user.id),
        isNull(schema.jobSearchPeriods.endedAt),
      ),
    );

  const inserted = await db
    .insert(schema.jobSearchPeriods)
    .values({
      userId: user.id,
      name: parsed.data.name?.trim() || null,
      startedAt: parsed.data.startedAt ?? today,
      endedAt: null,
    })
    .returning();

  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/jobs");
  revalidatePath("/settings");
  return { ok: true as const, period: inserted[0] };
}

export async function endJobSearchPeriod() {
  const user = await requireUser();

  const active = await db
    .select()
    .from(schema.jobSearchPeriods)
    .where(
      and(
        eq(schema.jobSearchPeriods.userId, user.id),
        isNull(schema.jobSearchPeriods.endedAt),
      ),
    )
    .limit(1);

  if (!active[0]) {
    return { ok: false as const, error: "Ingen aktiv periode" };
  }

  await db
    .update(schema.jobSearchPeriods)
    .set({ endedAt: todayIsoDate() })
    .where(eq(schema.jobSearchPeriods.id, active[0].id));

  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/jobs");
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function updateJobSearchPeriod(input: {
  id: number;
  name?: string | null;
  startedAt?: string;
  endedAt?: string | null;
}) {
  const user = await requireUser();
  const fields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    fields.name = input.name?.trim() || null;
  }
  if (input.startedAt !== undefined) fields.startedAt = input.startedAt;
  if (input.endedAt !== undefined) fields.endedAt = input.endedAt;
  if (Object.keys(fields).length === 0) return { ok: true as const };

  await db
    .update(schema.jobSearchPeriods)
    .set(fields)
    .where(
      and(
        eq(schema.jobSearchPeriods.id, input.id),
        eq(schema.jobSearchPeriods.userId, user.id),
      ),
    );

  revalidatePath("/jobs");
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function deleteJobSearchPeriod(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.jobSearchPeriods)
    .where(
      and(
        eq(schema.jobSearchPeriods.id, id),
        eq(schema.jobSearchPeriods.userId, user.id),
      ),
    );
  revalidatePath("/jobs");
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function getActiveJobSearchPeriod() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.jobSearchPeriods)
    .where(
      and(
        eq(schema.jobSearchPeriods.userId, user.id),
        isNull(schema.jobSearchPeriods.endedAt),
      ),
    )
    .orderBy(desc(schema.jobSearchPeriods.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listJobSearchPeriods() {
  const user = await requireUser();
  return db
    .select()
    .from(schema.jobSearchPeriods)
    .where(eq(schema.jobSearchPeriods.userId, user.id))
    .orderBy(desc(schema.jobSearchPeriods.startedAt));
}

// Helper til at få ansøgninger inden for en periode.
export async function listApplicationsInPeriod(
  startedAt: string,
  endedAt: string | null,
) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.jobApplications)
    .where(eq(schema.jobApplications.userId, user.id))
    .orderBy(asc(schema.jobApplications.sentAt));
  const end = endedAt ?? "9999-12-31";
  return rows.filter(
    (r) => r.sentAt !== null && r.sentAt >= startedAt && r.sentAt <= end,
  );
}
