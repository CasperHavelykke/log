"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { todayIsoDate } from "@/lib/date";

const dayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.coerce.number().int().min(1).max(5).nullable(),
  energy: z.coerce.number().int().min(1).max(5).nullable(),
  sleepHoursX10: z.coerce.number().int().min(0).max(240).nullable(),
  sleepQuality: z.coerce.number().int().min(1).max(4).nullable(),
  alcoholUnits: z.coerce.number().int().min(0).max(50).nullable(),
  didExercise: z.boolean(),
  exerciseIntensity: z.enum(["light", "medium", "hard"]).nullable(),
  didFast: z.boolean(),
  fastHoursX10: z.coerce.number().int().min(0).max(480).nullable(),
  fastBreakTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  weightX10: z.coerce.number().int().min(0).max(5000).nullable(),
  waistX10: z.coerce.number().int().min(0).max(3000).nullable(),
  carbsG: z.coerce.number().int().min(0).max(2000).nullable(),
  proteinG: z.coerce.number().int().min(0).max(1000).nullable(),
  fatG: z.coerce.number().int().min(0).max(1000).nullable(),
  workNotes: z.string().max(10_000).nullable(),
  healthNotes: z.string().max(10_000).nullable(),
  dayNotes: z.string().max(10_000).nullable(),
  wentWell: z.string().max(10_000).nullable(),
  nextStep: z.string().max(10_000).nullable(),
});

export type DayEntryInput = z.infer<typeof dayEntrySchema>;
export type SaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; error: string };

export async function saveDayEntry(input: DayEntryInput): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = dayEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldigt input" };
  }
  const data = parsed.data;

  const existing = await db
    .select()
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, user.id),
        eq(schema.dayEntries.date, data.date),
      ),
    )
    .limit(1);

  const now = new Date().toISOString();
  const fields = {
    mood: data.mood,
    energy: data.energy,
    sleepHours: data.sleepHoursX10,
    sleepQuality: data.sleepQuality,
    alcoholUnits: data.alcoholUnits,
    didExercise: data.didExercise,
    exerciseIntensity: data.didExercise ? data.exerciseIntensity : null,
    didFast: data.didFast,
    fastHoursX10: data.didFast ? data.fastHoursX10 : null,
    fastBreakTime: data.didFast ? data.fastBreakTime : null,
    weightX10: data.weightX10,
    waistX10: data.waistX10,
    carbsG: data.carbsG,
    proteinG: data.proteinG,
    fatG: data.fatG,
    workNotes: nullIfEmpty(data.workNotes),
    healthNotes: nullIfEmpty(data.healthNotes),
    dayNotes: nullIfEmpty(data.dayNotes),
    wentWell: nullIfEmpty(data.wentWell),
    nextStep: nullIfEmpty(data.nextStep),
  };

  if (existing[0]) {
    await db
      .update(schema.dayEntries)
      .set({ ...fields, updatedAt: now })
      .where(eq(schema.dayEntries.id, existing[0].id));
  } else {
    await db.insert(schema.dayEntries).values({
      userId: user.id,
      date: data.date,
      ...fields,
    });
  }

  revalidatePath("/today");
  return { ok: true, savedAt: now };
}

const weekGoalSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().max(2_000).default(""),
  applicationsTarget: z.coerce.number().int().min(0).max(1000).nullable(),
  focusHoursTargetX10: z.coerce.number().int().min(0).max(2400).nullable(),
});

export async function setWeekGoal(input: z.infer<typeof weekGoalSchema>) {
  const user = await requireUser();
  const parsed = weekGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { weekStart, text, applicationsTarget, focusHoursTargetX10 } =
    parsed.data;
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(schema.weekGoals)
    .where(
      and(
        eq(schema.weekGoals.userId, user.id),
        eq(schema.weekGoals.weekStart, weekStart),
      ),
    )
    .limit(1);

  const allEmpty =
    text.trim() === "" &&
    applicationsTarget === null &&
    focusHoursTargetX10 === null;

  if (allEmpty) {
    if (existing[0]) {
      await db
        .delete(schema.weekGoals)
        .where(eq(schema.weekGoals.id, existing[0].id));
    }
  } else if (existing[0]) {
    await db
      .update(schema.weekGoals)
      .set({
        text,
        applicationsTarget,
        focusHoursTargetX10,
        updatedAt: now,
      })
      .where(eq(schema.weekGoals.id, existing[0].id));
  } else {
    await db.insert(schema.weekGoals).values({
      userId: user.id,
      weekStart,
      text,
      applicationsTarget,
      focusHoursTargetX10,
    });
  }

  revalidatePath("/today");
  return { ok: true as const };
}

const dayGoalsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  applicationsTarget: z.coerce.number().int().min(0).max(100).nullable(),
  focusHoursTargetX10: z.coerce.number().int().min(0).max(240).nullable(),
  goalNote: z.string().max(2_000),
});

export async function saveDayGoals(input: z.infer<typeof dayGoalsSchema>) {
  const user = await requireUser();
  const parsed = dayGoalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { date, applicationsTarget, focusHoursTargetX10, goalNote } = parsed.data;
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, user.id),
        eq(schema.dayEntries.date, date),
      ),
    )
    .limit(1);

  const fields = {
    applicationsTarget,
    focusHoursTargetX10,
    goalNote: nullIfEmpty(goalNote),
  };

  if (existing[0]) {
    await db
      .update(schema.dayEntries)
      .set({ ...fields, updatedAt: now })
      .where(eq(schema.dayEntries.id, existing[0].id));
  } else {
    await db.insert(schema.dayEntries).values({
      userId: user.id,
      date,
      ...fields,
    });
  }

  revalidatePath("/today");
  return { ok: true as const };
}

const projectSchema = z.object({ name: z.string().min(1).max(120) });

export async function createProject(input: z.infer<typeof projectSchema>) {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt projektnavn" };

  const inserted = await db
    .insert(schema.projects)
    .values({ userId: user.id, name: parsed.data.name.trim() })
    .returning();

  revalidatePath("/today");
  revalidatePath("/projects");
  return { ok: true as const, project: inserted[0] };
}

export async function setFocusProject(projectId: number | null) {
  const user = await requireUser();
  if (projectId !== null) {
    const rows = await db
      .select()
      .from(schema.projects)
      .where(
        and(eq(schema.projects.userId, user.id), eq(schema.projects.id, projectId)),
      )
      .limit(1);
    if (!rows[0]) return { ok: false as const, error: "Projekt findes ikke" };
  }
  await db
    .update(schema.users)
    .set({ focusProjectId: projectId })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/today");
  return { ok: true as const };
}

const focusTimeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.number().int(),
  worked: z.boolean(),
  hoursX10: z.coerce.number().int().min(0).max(240).nullable(),
  notes: z.string().max(10_000).nullable(),
});

export async function saveFocusTime(input: z.infer<typeof focusTimeSchema>) {
  const user = await requireUser();
  const parsed = focusTimeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { date, projectId, worked, hoursX10, notes } = parsed.data;

  const existing = await db
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        eq(schema.timeEntries.userId, user.id),
        eq(schema.timeEntries.projectId, projectId),
        eq(schema.timeEntries.date, date),
      ),
    )
    .limit(1);

  if (!worked || hoursX10 === null || hoursX10 === 0) {
    if (existing[0]) {
      await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, existing[0].id));
    }
  } else if (existing[0]) {
    await db
      .update(schema.timeEntries)
      .set({
        hoursX10,
        notes: nullIfEmpty(notes),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.timeEntries.id, existing[0].id));
  } else {
    await db.insert(schema.timeEntries).values({
      userId: user.id,
      projectId,
      date,
      hoursX10,
      notes: nullIfEmpty(notes),
    });
  }

  revalidatePath("/today");
  return { ok: true as const };
}

const newApplicationSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().max(200).nullable(),
  files: z.string().max(2_000).nullable(),
  applicationText: z.string().max(100_000).nullable().optional(),
  status: z.enum(schema.JOB_STATUSES).default("sent"),
  sentAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function createJobApplication(
  input: z.infer<typeof newApplicationSchema>,
) {
  const user = await requireUser();
  const parsed = newApplicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { company, role, files, applicationText, status, sentAt } = parsed.data;

  const effectiveSentAt = sentAt ?? todayIsoDate();
  const inserted = await db
    .insert(schema.jobApplications)
    .values({
      userId: user.id,
      company: company.trim(),
      role: nullIfEmpty(role),
      files: nullIfEmpty(files),
      applicationText: nullIfEmpty(applicationText ?? null),
      status,
      sentAt: effectiveSentAt,
    })
    .returning();

  await db.insert(schema.applicationEvents).values({
    userId: user.id,
    applicationId: inserted[0].id,
    status,
    occurredAt: effectiveSentAt,
  });

  revalidatePath("/today");
  revalidatePath("/jobs");
  return { ok: true as const, application: inserted[0] };
}

export async function updateJobApplicationStatus(input: {
  id: number;
  status: schema.JobStatus;
}) {
  const user = await requireUser();
  if (!schema.JOB_STATUSES.includes(input.status)) {
    return { ok: false as const, error: "Ugyldig status" };
  }

  const current = await db
    .select()
    .from(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.id, input.id),
        eq(schema.jobApplications.userId, user.id),
      ),
    )
    .limit(1);
  if (!current[0]) return { ok: false as const, error: "Ansøgning findes ikke" };

  await db
    .update(schema.jobApplications)
    .set({ status: input.status, updatedAt: new Date().toISOString() })
    .where(eq(schema.jobApplications.id, input.id));

  if (current[0].status !== input.status) {
    await db.insert(schema.applicationEvents).values({
      userId: user.id,
      applicationId: input.id,
      status: input.status,
      occurredAt: todayIsoDate(),
    });
  }

  revalidatePath("/today");
  revalidatePath("/jobs");
  return { ok: true as const };
}

const updateApplicationSchema = z.object({
  id: z.number().int(),
  company: z.string().min(1).max(200).optional(),
  role: z.string().max(200).nullable().optional(),
  status: z.enum(schema.JOB_STATUSES).optional(),
  files: z.string().max(2_000).nullable().optional(),
  applicationText: z.string().max(100_000).nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  contactPerson: z.string().max(200).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
  sentAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function updateJobApplication(
  input: z.infer<typeof updateApplicationSchema>,
) {
  const user = await requireUser();
  const parsed = updateApplicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { id, ...changes } = parsed.data;

  const current = await db
    .select()
    .from(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.id, id),
        eq(schema.jobApplications.userId, user.id),
      ),
    )
    .limit(1);
  if (!current[0]) return { ok: false as const, error: "Ansøgning findes ikke" };

  const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      fields[key] = value.trim() === "" ? null : value;
    } else {
      fields[key] = value;
    }
  }

  await db
    .update(schema.jobApplications)
    .set(fields)
    .where(eq(schema.jobApplications.id, id));

  if (changes.status !== undefined && changes.status !== current[0].status) {
    await db.insert(schema.applicationEvents).values({
      userId: user.id,
      applicationId: id,
      status: changes.status,
      occurredAt: todayIsoDate(),
    });
  }

  revalidatePath("/today");
  revalidatePath("/jobs");
  return { ok: true as const };
}

export async function deleteJobApplication(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.id, id),
        eq(schema.jobApplications.userId, user.id),
      ),
    );
  revalidatePath("/today");
  revalidatePath("/jobs");
  return { ok: true as const };
}

function nullIfEmpty(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.trim() === "" ? null : v;
}
