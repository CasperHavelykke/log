"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function changePassword(input: {
  current: string;
  next: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const ok = await verifyPassword(input.current, user.passwordHash);
  if (!ok) return { ok: false, error: "Forkert nuværende adgangskode." };
  if (input.next.length < 8) {
    return { ok: false, error: "Den nye adgangskode skal være mindst 8 tegn." };
  }
  if (input.next === input.current) {
    return { ok: false, error: "Den nye adgangskode må ikke være den samme." };
  }

  const passwordHash = await hashPassword(input.next);
  await db
    .update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, user.id));

  return { ok: true };
}

// --- import -----------------------------------------------------------------

const dayEntryRow = z.object({
  id: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.number().int().nullable().optional(),
  energy: z.number().int().nullable().optional(),
  sleepHours: z.number().int().nullable().optional(),
  sleepQuality: z.number().int().nullable().optional(),
  headache: z.boolean().optional(),
  headacheIntensity: z.number().int().nullable().optional(),
  iskiasPain: z.number().int().nullable().optional(),
  alcoholUnits: z.number().int().nullable().optional(),
  constipation: z.boolean().optional(),
  constipationPain: z.number().int().nullable().optional(),
  seborrheicDermatitis: z.number().int().nullable().optional(),
  didExercise: z.boolean().optional(),
  exerciseIntensity: z
    .enum(["light", "medium", "hard"])
    .nullable()
    .optional(),
  workNotes: z.string().nullable().optional(),
  healthNotes: z.string().nullable().optional(),
  wentWell: z.string().nullable().optional(),
  nextStep: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const projectRow = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: z.string().optional(),
});

const timeEntryRow = z.object({
  id: z.number().int(),
  projectId: z.number().int(),
  date: z.string(),
  hoursX10: z.number().int(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const jobApplicationRow = z.object({
  id: z.number().int(),
  company: z.string(),
  role: z.string().nullable().optional(),
  status: z.string(),
  files: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  applicationText: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const applicationEventRow = z.object({
  id: z.number().int(),
  applicationId: z.number().int(),
  status: z.string(),
  note: z.string().nullable().optional(),
  occurredAt: z.string(),
  createdAt: z.string().optional(),
});

const weekGoalRow = z.object({
  id: z.number().int(),
  weekStart: z.string(),
  text: z.string(),
  applicationsTarget: z.number().int().nullable().optional(),
  focusHoursTargetX10: z.number().int().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const supplementRow = z.object({
  id: z.number().int(),
  name: z.string(),
  defaultDoseAmountX100: z.number().int().nullable().optional(),
  defaultDoseUnit: z.string().nullable().optional(),
  defaultTimeOfDay: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: z.string().optional(),
});

const supplementIntakeRow = z.object({
  id: z.number().int(),
  supplementId: z.number().int(),
  date: z.string(),
  doseAmountX100: z.number().int().nullable().optional(),
  doseUnit: z.string().nullable().optional(),
  timeOfDay: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

const fastRow = z.object({
  id: z.number().int(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

const backupSchema = z.object({
  format: z.literal("log-backup"),
  version: z.number(),
  data: z.object({
    dayEntries: z.array(dayEntryRow),
    projects: z.array(projectRow),
    timeEntries: z.array(timeEntryRow),
    jobApplications: z.array(jobApplicationRow),
    applicationEvents: z.array(applicationEventRow),
    weekGoals: z.array(weekGoalRow),
    supplements: z.array(supplementRow).optional().default([]),
    supplementIntakes: z.array(supplementIntakeRow).optional().default([]),
    fasts: z.array(fastRow).optional().default([]),
  }),
});

const nowIso = () => new Date().toISOString();

export async function importData(
  raw: unknown,
): Promise<
  | { ok: true; counts: Record<string, number> }
  | { ok: false; error: string }
> {
  const user = await requireUser();

  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Filen er ikke en gyldig Log-backup (forkert format eller felter).",
    };
  }
  const d = parsed.data.data;

  // Referentiel integritet — valideres FØR noget slettes.
  const projectIds = new Set(d.projects.map((p) => p.id));
  for (const t of d.timeEntries) {
    if (!projectIds.has(t.projectId)) {
      return {
        ok: false,
        error: "Backup'en har en tidsregistrering uden tilhørende projekt — afbrudt.",
      };
    }
  }
  const appIds = new Set(d.jobApplications.map((a) => a.id));
  for (const e of d.applicationEvents) {
    if (!appIds.has(e.applicationId)) {
      return {
        ok: false,
        error: "Backup'en har en hændelse uden tilhørende ansøgning — afbrudt.",
      };
    }
  }

  const uid = user.id;

  // Refer. integritet for tilskuds-indtag
  const supplementIds = new Set(d.supplements.map((s) => s.id));
  for (const i of d.supplementIntakes) {
    if (!supplementIds.has(i.supplementId)) {
      return {
        ok: false,
        error:
          "Backup'en har et tilskuds-indtag uden tilhørende tilskud — afbrudt.",
      };
    }
  }

  // Slet eksisterende data (børn før forældre).
  await db.delete(schema.applicationEvents).where(eq(schema.applicationEvents.userId, uid));
  await db.delete(schema.timeEntries).where(eq(schema.timeEntries.userId, uid));
  await db.delete(schema.jobApplications).where(eq(schema.jobApplications.userId, uid));
  await db.delete(schema.projects).where(eq(schema.projects.userId, uid));
  await db.delete(schema.dayEntries).where(eq(schema.dayEntries.userId, uid));
  await db.delete(schema.weekGoals).where(eq(schema.weekGoals.userId, uid));
  await db.delete(schema.supplementIntakes).where(eq(schema.supplementIntakes.userId, uid));
  await db.delete(schema.supplements).where(eq(schema.supplements.userId, uid));
  await db.delete(schema.fasts).where(eq(schema.fasts.userId, uid));

  // Indsæt (forældre før børn).
  if (d.projects.length > 0) {
    await db.insert(schema.projects).values(
      d.projects.map((p) => ({
        id: p.id,
        userId: uid,
        name: p.name,
        color: p.color ?? null,
        archived: p.archived ?? false,
        sortOrder: p.sortOrder ?? 0,
        createdAt: p.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.jobApplications.length > 0) {
    await db.insert(schema.jobApplications).values(
      d.jobApplications.map((a) => ({
        id: a.id,
        userId: uid,
        company: a.company,
        role: a.role ?? null,
        status: a.status,
        files: a.files ?? null,
        url: a.url ?? null,
        contactPerson: a.contactPerson ?? null,
        notes: a.notes ?? null,
        applicationText: a.applicationText ?? null,
        sentAt: a.sentAt ?? null,
        createdAt: a.createdAt ?? nowIso(),
        updatedAt: a.updatedAt ?? nowIso(),
      })),
    );
  }
  if (d.timeEntries.length > 0) {
    await db.insert(schema.timeEntries).values(
      d.timeEntries.map((t) => ({
        id: t.id,
        userId: uid,
        projectId: t.projectId,
        date: t.date,
        hoursX10: t.hoursX10,
        notes: t.notes ?? null,
        createdAt: t.createdAt ?? nowIso(),
        updatedAt: t.updatedAt ?? nowIso(),
      })),
    );
  }
  if (d.applicationEvents.length > 0) {
    await db.insert(schema.applicationEvents).values(
      d.applicationEvents.map((e) => ({
        id: e.id,
        userId: uid,
        applicationId: e.applicationId,
        status: e.status,
        note: e.note ?? null,
        occurredAt: e.occurredAt,
        createdAt: e.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.dayEntries.length > 0) {
    await db.insert(schema.dayEntries).values(
      d.dayEntries.map((e) => ({
        id: e.id,
        userId: uid,
        date: e.date,
        mood: e.mood ?? null,
        energy: e.energy ?? null,
        sleepHours: e.sleepHours ?? null,
        sleepQuality:
          e.sleepQuality === null || e.sleepQuality === undefined
            ? null
            : Math.min(e.sleepQuality, 4),
        headache: e.headache ?? false,
        headacheIntensity: e.headacheIntensity ?? null,
        iskiasPain: e.iskiasPain ?? null,
        alcoholUnits: e.alcoholUnits ?? null,
        constipation: e.constipation ?? false,
        constipationPain: e.constipationPain ?? null,
        seborrheicDermatitis: e.seborrheicDermatitis ?? null,
        didExercise: e.didExercise ?? false,
        exerciseIntensity: e.exerciseIntensity ?? null,
        workNotes: e.workNotes ?? null,
        healthNotes: e.healthNotes ?? null,
        wentWell: e.wentWell ?? null,
        nextStep: e.nextStep ?? null,
        createdAt: e.createdAt ?? nowIso(),
        updatedAt: e.updatedAt ?? nowIso(),
      })),
    );
  }
  if (d.weekGoals.length > 0) {
    await db.insert(schema.weekGoals).values(
      d.weekGoals.map((g) => ({
        id: g.id,
        userId: uid,
        weekStart: g.weekStart,
        text: g.text,
        applicationsTarget: g.applicationsTarget ?? null,
        focusHoursTargetX10: g.focusHoursTargetX10 ?? null,
        createdAt: g.createdAt ?? nowIso(),
        updatedAt: g.updatedAt ?? nowIso(),
      })),
    );
  }
  if (d.supplements.length > 0) {
    await db.insert(schema.supplements).values(
      d.supplements.map((s) => ({
        id: s.id,
        userId: uid,
        name: s.name,
        defaultDoseAmountX100: s.defaultDoseAmountX100 ?? null,
        defaultDoseUnit: s.defaultDoseUnit ?? null,
        defaultTimeOfDay: s.defaultTimeOfDay ?? null,
        notes: s.notes ?? null,
        archived: s.archived ?? false,
        sortOrder: s.sortOrder ?? 0,
        createdAt: s.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.fasts.length > 0) {
    await db.insert(schema.fasts).values(
      d.fasts.map((f) => ({
        id: f.id,
        userId: uid,
        startedAt: f.startedAt,
        endedAt: f.endedAt ?? null,
        note: f.note ?? null,
        createdAt: f.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.supplementIntakes.length > 0) {
    await db.insert(schema.supplementIntakes).values(
      d.supplementIntakes.map((i) => ({
        id: i.id,
        userId: uid,
        supplementId: i.supplementId,
        date: i.date,
        doseAmountX100: i.doseAmountX100 ?? null,
        doseUnit: i.doseUnit ?? null,
        timeOfDay: i.timeOfDay ?? null,
        note: i.note ?? null,
        createdAt: i.createdAt ?? nowIso(),
      })),
    );
  }

  for (const path of ["/", "/today", "/jobs", "/projects", "/health", "/journal"]) {
    revalidatePath(path);
  }

  return {
    ok: true,
    counts: {
      dayEntries: d.dayEntries.length,
      projects: d.projects.length,
      timeEntries: d.timeEntries.length,
      jobApplications: d.jobApplications.length,
      applicationEvents: d.applicationEvents.length,
      weekGoals: d.weekGoals.length,
      supplements: d.supplements.length,
      supplementIntakes: d.supplementIntakes.length,
    },
  };
}
