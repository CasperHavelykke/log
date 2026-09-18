"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { todayIsoDate } from "@/lib/date";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const goalSchema = z
  .object({
    id: z.number().int().optional(),
    title: z.string().min(1).max(200),
    groupLabel: z.string().max(100).nullable().default(null),
    kind: z.enum(schema.GOAL_KINDS),
    targetValue: z.number().int().min(1).max(100_000_000).nullable().default(null),
    unit: z.string().max(30).nullable().default(null),
    startDate: z.string().regex(DATE_RE),
    deadline: z.string().regex(DATE_RE),
    note: z.string().max(2_000).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "milestone" && v.targetValue === null) {
      ctx.addIssue({ code: "custom", message: "Angiv et mål-tal" });
    }
    if (v.deadline <= v.startDate) {
      ctx.addIssue({ code: "custom", message: "Deadline skal ligge efter start" });
    }
  });

export type GoalInput = z.infer<typeof goalSchema>;

function revalidateGoalPaths() {
  revalidatePath("/today");
  revalidatePath("/statistik");
}

export async function upsertGoal(input: GoalInput) {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const d = parsed.data;
  const now = new Date().toISOString();
  const values = {
    title: d.title.trim(),
    groupLabel: d.groupLabel?.trim() || null,
    kind: d.kind,
    targetValue: d.kind === "milestone" ? null : d.targetValue,
    unit: d.kind === "milestone" ? null : d.unit?.trim() || null,
    startDate: d.startDate,
    deadline: d.deadline,
    note: d.note?.trim() || null,
    updatedAt: now,
  };

  if (d.id !== undefined) {
    const existing = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(and(eq(schema.goals.id, d.id), eq(schema.goals.userId, user.id)))
      .limit(1);
    if (!existing[0]) return { ok: false as const, error: "Målet findes ikke" };
    await db.update(schema.goals).set(values).where(eq(schema.goals.id, d.id));
    revalidateGoalPaths();
    return { ok: true as const, id: d.id };
  }

  const inserted = await db
    .insert(schema.goals)
    .values({ userId: user.id, ...values, createdAt: now })
    .returning();
  revalidateGoalPaths();
  return { ok: true as const, id: inserted[0].id };
}

export async function deleteGoal(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.goals)
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, user.id)));
  revalidateGoalPaths();
  return { ok: true as const };
}

// Log fremskridt: count = delta (fx +1 maleri), level = ny måling (fx
// følgertal 340). Dato udeladt = i dag.
export async function logGoalProgress(input: {
  goalId: number;
  value: number;
  date?: string;
  note?: string | null;
}) {
  const user = await requireUser();
  if (!Number.isInteger(input.value)) {
    return { ok: false as const, error: "Ugyldig værdi" };
  }
  const date = input.date ?? todayIsoDate();
  if (!DATE_RE.test(date)) return { ok: false as const, error: "Ugyldig dato" };
  const rows = await db
    .select()
    .from(schema.goals)
    .where(
      and(eq(schema.goals.id, input.goalId), eq(schema.goals.userId, user.id)),
    )
    .limit(1);
  const goal = rows[0];
  if (!goal) return { ok: false as const, error: "Målet findes ikke" };
  if (goal.kind === "milestone") {
    return { ok: false as const, error: "Milepæle krydses af, ikke logges" };
  }
  if (goal.kind === "level" && input.value < 0) {
    return { ok: false as const, error: "Niveau kan ikke være negativt" };
  }
  const inserted = await db
    .insert(schema.goalEntries)
    .values({
      userId: user.id,
      goalId: goal.id,
      date,
      value: input.value,
      note: input.note?.trim() || null,
    })
    .returning();
  revalidateGoalPaths();
  return { ok: true as const, entryId: inserted[0].id };
}

export async function deleteGoalEntry(entryId: number) {
  const user = await requireUser();
  await db
    .delete(schema.goalEntries)
    .where(
      and(
        eq(schema.goalEntries.id, entryId),
        eq(schema.goalEntries.userId, user.id),
      ),
    );
  revalidateGoalPaths();
  return { ok: true as const };
}

export async function setMilestoneDone(id: number, done: boolean) {
  const user = await requireUser();
  const rows = await db
    .select({ id: schema.goals.id, kind: schema.goals.kind })
    .from(schema.goals)
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, user.id)))
    .limit(1);
  if (!rows[0]) return { ok: false as const, error: "Målet findes ikke" };
  if (rows[0].kind !== "milestone") {
    return { ok: false as const, error: "Kun milepæle kan krydses af" };
  }
  await db
    .update(schema.goals)
    .set({
      completedAt: done ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.goals.id, id));
  revalidateGoalPaths();
  return { ok: true as const };
}

// Seneste registreringer til dialogens fortryd-liste.
export async function listGoalEntries(goalId: number, limit = 8) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.goalEntries)
    .where(
      and(
        eq(schema.goalEntries.goalId, goalId),
        eq(schema.goalEntries.userId, user.id),
      ),
    );
  return rows
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map((e) => ({ id: e.id, date: e.date, value: e.value, note: e.note }));
}
