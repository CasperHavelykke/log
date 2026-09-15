"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { addDaysIso, todayIsoDate } from "@/lib/date";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const planItemSchema = z
  .object({
    id: z.number().int().optional(),
    kind: z.enum(schema.PLAN_KINDS),
    projectId: z.number().int().nullable().default(null),
    supplementId: z.number().int().nullable().default(null),
    workoutTemplateId: z.number().int().nullable().default(null),
    label: z.string().max(200).nullable().default(null),
    scheduleType: z.enum(schema.PLAN_SCHEDULE_TYPES),
    weekdays: z
      .string()
      .regex(/^[0-6](,[0-6]){0,6}$/)
      .nullable()
      .default(null),
    intervalDays: z.number().int().min(1).max(365).nullable().default(null),
    anchorDate: z.string().regex(DATE_RE).nullable().default(null),
    timeOfDay: z.string().max(50).nullable().default(null),
    minutesPlanned: z.number().int().min(5).max(1440).nullable().default(null),
    doseTargetX100: z
      .number()
      .int()
      .min(0)
      .max(10_000_000)
      .nullable()
      .default(null),
    doseUnit: z.string().max(20).nullable().default(null),
    // Ernærings-mål som intervaller: *Target = minimum, *Max = loft.
    kcalTarget: z.number().int().min(0).max(10_000).nullable().default(null),
    kcalMax: z.number().int().min(0).max(10_000).nullable().default(null),
    carbsTargetG: z.number().int().min(0).max(2000).nullable().default(null),
    carbsMaxG: z.number().int().min(0).max(2000).nullable().default(null),
    proteinTargetG: z.number().int().min(0).max(1000).nullable().default(null),
    proteinMaxG: z.number().int().min(0).max(1000).nullable().default(null),
    fatTargetG: z.number().int().min(0).max(1000).nullable().default(null),
    fatMaxG: z.number().int().min(0).max(1000).nullable().default(null),
    fiberTargetG: z.number().int().min(0).max(200).nullable().default(null),
    fiberMaxG: z.number().int().min(0).max(200).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    const pairs: [number | null, number | null][] = [
      [v.kcalTarget, v.kcalMax],
      [v.carbsTargetG, v.carbsMaxG],
      [v.proteinTargetG, v.proteinMaxG],
      [v.fatTargetG, v.fatMaxG],
      [v.fiberTargetG, v.fiberMaxG],
    ];
    if (pairs.some(([min, max]) => min !== null && max !== null && max < min)) {
      ctx.addIssue({
        code: "custom",
        message: "Maksimum skal være mindst lig minimum",
      });
    }
    if (v.scheduleType === "weekdays" && !v.weekdays) {
      ctx.addIssue({ code: "custom", message: "Vælg mindst én ugedag" });
    }
    if (v.scheduleType === "interval" && !v.intervalDays) {
      ctx.addIssue({ code: "custom", message: "Angiv interval i dage" });
    }
    // Tilskuds-planer bindes via NAVNET (label) — chips er kun genveje.
    if (v.kind === "supplement" && !v.label?.trim()) {
      ctx.addIssue({ code: "custom", message: "Angiv tilskuddets navn" });
    }
  });

export type PlanItemInput = z.infer<typeof planItemSchema>;

function revalidatePlanPaths() {
  revalidatePath("/today");
  revalidatePath("/projects");
  revalidatePath("/traening");
}

export async function upsertPlanItem(input: PlanItemInput) {
  const user = await requireUser();
  const parsed = planItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const d = parsed.data;
  const now = new Date().toISOString();
  // interval/monthly uden anker forankres i dag ("fra nu af").
  const anchorDate =
    d.scheduleType === "weekdays" ? null : (d.anchorDate ?? todayIsoDate());

  const values = {
    kind: d.kind,
    projectId: d.projectId,
    // supplementId sættes ikke længere — tilskud bindes via navnet (label).
    supplementId: null,
    workoutTemplateId: d.workoutTemplateId,
    label: d.label?.trim() || null,
    scheduleType: d.scheduleType,
    weekdays: d.scheduleType === "weekdays" ? d.weekdays : null,
    intervalDays: d.scheduleType === "interval" ? d.intervalDays : null,
    anchorDate,
    timeOfDay: d.timeOfDay?.trim() || null,
    minutesPlanned: d.kind === "project" ? d.minutesPlanned : null,
    doseTargetX100: d.kind === "supplement" ? d.doseTargetX100 : null,
    doseUnit: d.kind === "supplement" ? d.doseUnit?.trim() || null : null,
    kcalTarget: d.kind === "nutrition" ? d.kcalTarget : null,
    kcalMax: d.kind === "nutrition" ? d.kcalMax : null,
    carbsTargetG: d.kind === "nutrition" ? d.carbsTargetG : null,
    carbsMaxG: d.kind === "nutrition" ? d.carbsMaxG : null,
    proteinTargetG: d.kind === "nutrition" ? d.proteinTargetG : null,
    proteinMaxG: d.kind === "nutrition" ? d.proteinMaxG : null,
    fatTargetG: d.kind === "nutrition" ? d.fatTargetG : null,
    fatMaxG: d.kind === "nutrition" ? d.fatMaxG : null,
    fiberTargetG: d.kind === "nutrition" ? d.fiberTargetG : null,
    fiberMaxG: d.kind === "nutrition" ? d.fiberMaxG : null,
    updatedAt: now,
  };

  if (d.id !== undefined) {
    const existing = await db
      .select({ id: schema.planItems.id })
      .from(schema.planItems)
      .where(
        and(eq(schema.planItems.id, d.id), eq(schema.planItems.userId, user.id)),
      )
      .limit(1);
    if (!existing[0]) return { ok: false as const, error: "Planen findes ikke" };
    await db
      .update(schema.planItems)
      .set(values)
      .where(eq(schema.planItems.id, d.id));
    revalidatePlanPaths();
    return { ok: true as const, id: d.id };
  }

  const inserted = await db
    .insert(schema.planItems)
    .values({ userId: user.id, ...values, createdAt: now })
    .returning();
  revalidatePlanPaths();
  return { ok: true as const, id: inserted[0].id };
}

export async function deletePlanItem(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.planItems)
    .where(
      and(eq(schema.planItems.id, id), eq(schema.planItems.userId, user.id)),
    );
  revalidatePlanPaths();
  return { ok: true as const };
}

export async function setPlanItemPaused(id: number, paused: boolean) {
  const user = await requireUser();
  await db
    .update(schema.planItems)
    .set({ paused, updatedAt: new Date().toISOString() })
    .where(
      and(eq(schema.planItems.id, id), eq(schema.planItems.userId, user.id)),
    );
  revalidatePlanPaths();
  return { ok: true as const };
}

// Per-dag markering: 'done' (manuel afkrydsning) eller 'skip' ("ikke i
// dag"). Én mark per (item, dato) — en ny overskriver den gamle.
export async function markPlanItem(
  planItemId: number,
  date: string,
  kind: "done" | "skip",
) {
  const user = await requireUser();
  if (!DATE_RE.test(date)) return { ok: false as const, error: "Ugyldig dato" };
  const item = await db
    .select({ id: schema.planItems.id })
    .from(schema.planItems)
    .where(
      and(
        eq(schema.planItems.id, planItemId),
        eq(schema.planItems.userId, user.id),
      ),
    )
    .limit(1);
  if (!item[0]) return { ok: false as const, error: "Planen findes ikke" };

  await db
    .delete(schema.planMarks)
    .where(
      and(
        eq(schema.planMarks.planItemId, planItemId),
        eq(schema.planMarks.date, date),
      ),
    );
  await db.insert(schema.planMarks).values({
    userId: user.id,
    planItemId,
    date,
    kind,
  });
  revalidatePath("/today");
  return { ok: true as const };
}

// Udsæt til i morgen: 'postpone'-mark på dagen flytter forekomsten til
// dagen efter. For interval-planer rykkes ankeret samtidig, så rytmen
// fortsætter fra den nye dag ("hver 3. dag" tæller fra i morgen);
// ugedags- og månedsplaner får kun et engangs-ryk — deres rytme ligger
// fast på ugedage/dag-i-måneden.
export async function postponePlanItem(planItemId: number, date: string) {
  const user = await requireUser();
  if (!DATE_RE.test(date)) return { ok: false as const, error: "Ugyldig dato" };
  const rows = await db
    .select()
    .from(schema.planItems)
    .where(
      and(
        eq(schema.planItems.id, planItemId),
        eq(schema.planItems.userId, user.id),
      ),
    )
    .limit(1);
  const item = rows[0];
  if (!item) return { ok: false as const, error: "Planen findes ikke" };

  await db
    .delete(schema.planMarks)
    .where(
      and(
        eq(schema.planMarks.planItemId, planItemId),
        eq(schema.planMarks.date, date),
      ),
    );
  await db.insert(schema.planMarks).values({
    userId: user.id,
    planItemId,
    date,
    kind: "postpone",
  });
  if (item.scheduleType === "interval") {
    await db
      .update(schema.planItems)
      .set({
        anchorDate: addDaysIso(date, 1),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.planItems.id, planItemId));
  }
  revalidatePath("/today");
  return { ok: true as const };
}

// Fortryd en udsættelse: fjern marken og rul ankeret tilbage for
// interval-planer (anker = dagen selv er rytme-ækvivalent med det gamle
// anker, da dagen var en forekomst).
export async function undoPostponePlanItem(planItemId: number, date: string) {
  const user = await requireUser();
  if (!DATE_RE.test(date)) return { ok: false as const, error: "Ugyldig dato" };
  const rows = await db
    .select()
    .from(schema.planItems)
    .where(
      and(
        eq(schema.planItems.id, planItemId),
        eq(schema.planItems.userId, user.id),
      ),
    )
    .limit(1);
  const item = rows[0];
  if (!item) return { ok: false as const, error: "Planen findes ikke" };

  const deleted = await db
    .delete(schema.planMarks)
    .where(
      and(
        eq(schema.planMarks.planItemId, planItemId),
        eq(schema.planMarks.date, date),
        eq(schema.planMarks.kind, "postpone"),
      ),
    )
    .returning();
  if (deleted.length > 0 && item.scheduleType === "interval") {
    await db
      .update(schema.planItems)
      .set({ anchorDate: date, updatedAt: new Date().toISOString() })
      .where(eq(schema.planItems.id, planItemId));
  }
  revalidatePath("/today");
  return { ok: true as const };
}

export async function unmarkPlanItem(planItemId: number, date: string) {
  const user = await requireUser();
  if (!DATE_RE.test(date)) return { ok: false as const, error: "Ugyldig dato" };
  await db
    .delete(schema.planMarks)
    .where(
      and(
        eq(schema.planMarks.planItemId, planItemId),
        eq(schema.planMarks.date, date),
        eq(schema.planMarks.userId, user.id),
      ),
    );
  revalidatePath("/today");
  return { ok: true as const };
}

// Klik på en planlagt træning med skabelon: opret dagens session forudfyldt
// fra skabelonen og send brugeren direkte i redigering.
export async function startPlannedWorkout(planItemId: number) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.planItems)
    .where(
      and(
        eq(schema.planItems.id, planItemId),
        eq(schema.planItems.userId, user.id),
      ),
    )
    .limit(1);
  const item = rows[0];
  if (!item?.workoutTemplateId) {
    return { ok: false as const, error: "Planen har ingen skabelon" };
  }
  const templates = await db
    .select()
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, item.workoutTemplateId),
        eq(schema.workoutTemplates.userId, user.id),
      ),
    )
    .limit(1);
  const template = templates[0];
  if (!template) {
    return { ok: false as const, error: "Skabelonen findes ikke længere" };
  }
  const now = new Date().toISOString();
  const date = todayIsoDate();
  const inserted = await db
    .insert(schema.workouts)
    .values({
      userId: user.id,
      title: template.title,
      date,
      durationMin: template.durationMin,
      body: template.body,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await markTrainedTodayInternal(user.id, date);
  revalidatePath("/today");
  revalidatePath("/traening");
  revalidatePath("/health");
  revalidatePath("/statistik");
  return { ok: true as const, workoutId: inserted[0].id };
}

async function markTrainedTodayInternal(userId: number, date: string) {
  const existing = await db
    .select({ id: schema.dayEntries.id, didExercise: schema.dayEntries.didExercise })
    .from(schema.dayEntries)
    .where(
      and(eq(schema.dayEntries.userId, userId), eq(schema.dayEntries.date, date)),
    )
    .limit(1);
  if (existing[0]) {
    if (!existing[0].didExercise) {
      await db
        .update(schema.dayEntries)
        .set({ didExercise: true, updatedAt: new Date().toISOString() })
        .where(eq(schema.dayEntries.id, existing[0].id));
    }
  } else {
    await db.insert(schema.dayEntries).values({ userId, date, didExercise: true });
  }
}

// Træning uden skabelon: afkrydsning sætter didExercise på dagen (samme
// regel som logget session — flaget ryddes aldrig automatisk).
export async function markTrainedToday(date: string) {
  const user = await requireUser();
  if (!DATE_RE.test(date)) return { ok: false as const, error: "Ugyldig dato" };
  await markTrainedTodayInternal(user.id, date);
  revalidatePath("/today");
  revalidatePath("/health");
  revalidatePath("/statistik");
  return { ok: true as const };
}
