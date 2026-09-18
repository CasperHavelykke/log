"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { todayIsoDate } from "@/lib/date";
import {
  getEffectiveWeekGoal,
  getSupplementIntakesOnDate,
} from "@/lib/queries";

// PARTIAL semantik: udeladt felt (undefined) = rør ikke det gemte; null =
// ryd feltet bevidst. Klienten sender kun de felter brugeren har ændret,
// så en formular der har stået åben (mens fx AI'en har logget makroer via
// MCP) ikke overskriver friske værdier med sine forældede tomme felter.
const dayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.coerce.number().int().min(1).max(5).nullable().optional(),
  energy: z.coerce.number().int().min(1).max(5).nullable().optional(),
  sleepHoursX10: z.coerce.number().int().min(0).max(240).nullable().optional(),
  sleepQuality: z.coerce.number().int().min(1).max(4).nullable().optional(),
  alcoholUnits: z.coerce.number().int().min(0).max(50).nullable().optional(),
  didExercise: z.boolean().optional(),
  exerciseIntensity: z.enum(["light", "medium", "hard"]).nullable().optional(),
  didFast: z.boolean().optional(),
  fastHoursX10: z.coerce.number().int().min(0).max(480).nullable().optional(),
  fastBreakTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  weightX10: z.coerce.number().int().min(0).max(5000).nullable().optional(),
  waistX10: z.coerce.number().int().min(0).max(3000).nullable().optional(),
  carbsG: z.coerce.number().int().min(0).max(2000).nullable().optional(),
  proteinG: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  fatG: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  fiberG: z.coerce.number().int().min(0).max(200).nullable().optional(),
  workNotes: z.string().max(10_000).nullable().optional(),
  healthNotes: z.string().max(10_000).nullable().optional(),
  dayNotes: z.string().max(10_000).nullable().optional(),
  wentWell: z.string().max(10_000).nullable().optional(),
  nextStep: z.string().max(10_000).nullable().optional(),
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
  // Kun medsendte felter skrives. Sammenhængende grupper (træning, faste)
  // sendes samlet af klienten; flagets false-værdi rydder altid sine
  // afhængige felter, som før.
  const fields: Partial<typeof schema.dayEntries.$inferInsert> = {};
  if (data.mood !== undefined) fields.mood = data.mood;
  if (data.energy !== undefined) fields.energy = data.energy;
  if (data.sleepHoursX10 !== undefined) fields.sleepHours = data.sleepHoursX10;
  if (data.sleepQuality !== undefined) fields.sleepQuality = data.sleepQuality;
  if (data.alcoholUnits !== undefined) fields.alcoholUnits = data.alcoholUnits;
  if (data.didExercise !== undefined) {
    fields.didExercise = data.didExercise;
    fields.exerciseIntensity = data.didExercise
      ? (data.exerciseIntensity ?? null)
      : null;
  }
  if (data.didFast !== undefined) {
    fields.didFast = data.didFast;
    fields.fastHoursX10 = data.didFast ? (data.fastHoursX10 ?? null) : null;
    fields.fastBreakTime = data.didFast ? (data.fastBreakTime ?? null) : null;
  }
  if (data.weightX10 !== undefined) fields.weightX10 = data.weightX10;
  if (data.waistX10 !== undefined) fields.waistX10 = data.waistX10;
  if (data.carbsG !== undefined) fields.carbsG = data.carbsG;
  if (data.proteinG !== undefined) fields.proteinG = data.proteinG;
  if (data.fatG !== undefined) fields.fatG = data.fatG;
  if (data.fiberG !== undefined) fields.fiberG = data.fiberG;
  if (data.workNotes !== undefined) fields.workNotes = nullIfEmpty(data.workNotes);
  if (data.healthNotes !== undefined)
    fields.healthNotes = nullIfEmpty(data.healthNotes);
  if (data.dayNotes !== undefined) fields.dayNotes = nullIfEmpty(data.dayNotes);
  if (data.wentWell !== undefined) fields.wentWell = nullIfEmpty(data.wentWell);
  if (data.nextStep !== undefined) fields.nextStep = nullIfEmpty(data.nextStep);

  if (Object.keys(fields).length === 0) {
    return { ok: true, savedAt: existing[0]?.updatedAt ?? now };
  }

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

// Frisk øjebliksbillede af dagen til formularens genopfriskning ved
// fokus: felter brugeren ikke selv har ændret, opdateres til serverens
// aktuelle værdier (fx makroer logget af AI via MCP mens fanen lå i
// baggrunden). Returnerer samme form som page.tsx's initialDay.
export async function getDaySnapshot(date: string) {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false as const, error: "Ugyldig dato" };
  }
  const rows = await db
    .select()
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, user.id),
        eq(schema.dayEntries.date, date),
      ),
    )
    .limit(1);
  const entry = rows[0];
  const intakes = await getSupplementIntakesOnDate(user.id, date);
  return {
    ok: true as const,
    lastSavedAt: entry?.updatedAt ?? null,
    day: {
      mood: entry?.mood ?? null,
      energy: entry?.energy ?? null,
      sleepHoursX10: entry?.sleepHours ?? null,
      sleepQuality: entry?.sleepQuality ?? null,
      alcoholUnits: entry?.alcoholUnits ?? null,
      didExercise: entry?.didExercise ?? false,
      exerciseIntensity:
        (entry?.exerciseIntensity as "light" | "medium" | "hard" | null) ??
        null,
      didFast: entry?.didFast ?? false,
      fastHoursX10: entry?.fastHoursX10 ?? null,
      fastBreakTime: entry?.fastBreakTime ?? null,
      weightX10: entry?.weightX10 ?? null,
      waistX10: entry?.waistX10 ?? null,
      carbsG: entry?.carbsG ?? null,
      proteinG: entry?.proteinG ?? null,
      fatG: entry?.fatG ?? null,
      fiberG: entry?.fiberG ?? null,
      workNotes: entry?.workNotes ?? "",
      healthNotes: entry?.healthNotes ?? "",
      dayNotes: entry?.dayNotes ?? "",
      wentWell: entry?.wentWell ?? "",
      nextStep: entry?.nextStep ?? "",
    },
    intakes: intakes.map((i) => ({
      id: i.id,
      name: i.name,
      supplementId: i.supplementId,
      doseAmountX100: i.doseAmountX100,
      doseUnit: i.doseUnit,
      timeOfDay: i.timeOfDay as "morning" | "midday" | "evening" | "night" | null,
      note: i.note,
    })),
  };
}

// Partial update-semantik: udeladt felt (undefined) = rør ikke det
// eksisterende; null = ryd feltet bevidst. Så /jobs kan sætte ansøgnings-
// målet uden at klippe /projekters fokus-timer-mål og omvendt.
const weekGoalSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().max(2_000).optional(),
  applicationsTarget: z.coerce
    .number()
    .int()
    .min(0)
    .max(1000)
    .nullable()
    .optional(),
  focusHoursTargetX10: z.coerce
    .number()
    .int()
    .min(0)
    .max(2400)
    .nullable()
    .optional(),
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

  // Uge uden egen række viser ARVEDE talmål fra sidste uge — redigering
  // af ét felt må ikke smide de andre væk. Ikke-redigerede felter seedes
  // derfor fra det arvede, så det man ser på skærmen er det der gemmes.
  // Tekst arver aldrig (som i getEffectiveWeekGoal).
  const inherited = existing[0]
    ? null
    : await getEffectiveWeekGoal(user.id, weekStart);

  const merged = {
    text: text !== undefined ? text : existing[0]?.text ?? "",
    applicationsTarget:
      applicationsTarget !== undefined
        ? applicationsTarget
        : existing[0]?.applicationsTarget ??
          inherited?.applicationsTarget ??
          null,
    focusHoursTargetX10:
      focusHoursTargetX10 !== undefined
        ? focusHoursTargetX10
        : existing[0]?.focusHoursTargetX10 ??
          inherited?.focusHoursTargetX10 ??
          null,
  };

  const allEmpty =
    merged.text.trim() === "" &&
    merged.applicationsTarget === null &&
    merged.focusHoursTargetX10 === null;

  if (allEmpty) {
    if (existing[0]) {
      await db
        .delete(schema.weekGoals)
        .where(eq(schema.weekGoals.id, existing[0].id));
    }
  } else if (existing[0]) {
    await db
      .update(schema.weekGoals)
      .set({ ...merged, updatedAt: now })
      .where(eq(schema.weekGoals.id, existing[0].id));
  } else {
    await db.insert(schema.weekGoals).values({
      userId: user.id,
      weekStart,
      ...merged,
    });
  }

  revalidatePath("/today");
  return { ok: true as const };
}

const dayGoalsSchema = z.object({
  // PARTIAL: udeladt felt røres ikke (samme semantik som saveDayEntry).
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  applicationsTarget: z.coerce.number().int().min(0).max(100).nullable().optional(),
  focusHoursTargetX10: z.coerce
    .number()
    .int()
    .min(0)
    .max(240)
    .nullable()
    .optional(),
  goalNote: z.string().max(2_000).optional(),
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

  // Bevidst IKKE nullIfEmpty for goalNote: tom streng betyder "brugeren har
  // ryddet feltet i dag" og skal NOT autoudfyldes med gårsdagens mål.
  // null = aldrig rørt for denne dato → page.tsx må falde tilbage til seneste.
  const fields: Partial<typeof schema.dayEntries.$inferInsert> = {};
  if (applicationsTarget !== undefined) {
    fields.applicationsTarget = applicationsTarget;
  }
  if (focusHoursTargetX10 !== undefined) {
    fields.focusHoursTargetX10 = focusHoursTargetX10;
  }
  if (goalNote !== undefined) fields.goalNote = goalNote;
  if (Object.keys(fields).length === 0) return { ok: true as const };

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

  let event: {
    id: number;
    status: schema.JobStatus;
    occurredAt: string;
    note: string | null;
  } | null = null;
  if (current[0].status !== input.status) {
    const inserted = await db
      .insert(schema.applicationEvents)
      .values({
        userId: user.id,
        applicationId: input.id,
        status: input.status,
        occurredAt: todayIsoDate(),
      })
      .returning();
    if (inserted[0]) {
      event = {
        id: inserted[0].id,
        status: inserted[0].status as schema.JobStatus,
        occurredAt: inserted[0].occurredAt,
        note: inserted[0].note ?? null,
      };
    }
  }

  revalidatePath("/today");
  revalidatePath("/jobs");
  return { ok: true as const, event };
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
