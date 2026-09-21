import "server-only";

import { inArray, eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";

const BLOB_ROOT = resolve(process.cwd(), process.env.DATA_DIR ?? "data");

// dayEntryRow accepterer både v1 (med headache/iskiasPain osv.) og v2.
// De gamle felter ignoreres ved insert siden de er flyttet til
// custom_parameter_values.
const dayEntryRow = z
  .object({
    id: z.number().int(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mood: z.number().int().nullable().optional(),
    energy: z.number().int().nullable().optional(),
    sleepHours: z.number().int().nullable().optional(),
    sleepQuality: z.number().int().nullable().optional(),
    alcoholUnits: z.number().int().nullable().optional(),
    didExercise: z.boolean().optional(),
    exerciseIntensity: z
      .enum(["light", "medium", "hard"])
      .nullable()
      .optional(),
    didFast: z.boolean().optional(),
    fastHoursX10: z.number().int().nullable().optional(),
    fastBreakTime: z.string().nullable().optional(),
    weightX10: z.number().int().nullable().optional(),
    waistX10: z.number().int().nullable().optional(),
    carbsG: z.number().int().nullable().optional(),
    proteinG: z.number().int().nullable().optional(),
    fatG: z.number().int().nullable().optional(),
    fiberG: z.number().int().nullable().optional(),
    workNotes: z.string().nullable().optional(),
    healthNotes: z.string().nullable().optional(),
    dayNotes: z.string().nullable().optional(),
    wentWell: z.string().nullable().optional(),
    nextStep: z.string().nullable().optional(),
    applicationsTarget: z.number().int().nullable().optional(),
    focusHoursTargetX10: z.number().int().nullable().optional(),
    goalNote: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

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
  // Navnet er intakes' PRIMÆRE kobling (aggregering sker på navn, ikke
  // FK) — uden det vises indtag som "Ukendt" og mangler i statistik.
  name: z.string().optional().default(""),
  // Nullable: sletning af et tilskud sætter historiske intakes' FK til
  // null (ON DELETE SET NULL) — de rækker skal stadig kunne importeres.
  supplementId: z.number().int().nullable(),
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

const sleepEntryRow = z.object({
  id: z.number().int(),
  date: z.string(),
  source: z.string().optional(),
  durationMin: z.number().int().nullable().optional(),
  score: z.number().int().nullable().optional(),
  qualityLabel: z.string().nullable().optional(),
  deepMin: z.number().int().nullable().optional(),
  lightMin: z.number().int().nullable().optional(),
  remMin: z.number().int().nullable().optional(),
  awakeMin: z.number().int().nullable().optional(),
  avgStress: z.number().int().nullable().optional(),
  breathingVariation: z.string().nullable().optional(),
  restlessMoments: z.number().int().nullable().optional(),
  avgHeartRate: z.number().int().nullable().optional(),
  restingHeartRate: z.number().int().nullable().optional(),
  bodyBatteryChange: z.number().int().nullable().optional(),
  avgSpO2: z.number().int().nullable().optional(),
  lowestSpO2: z.number().int().nullable().optional(),
  avgBreathingX10: z.number().int().nullable().optional(),
  lowestBreathingX10: z.number().int().nullable().optional(),
  hrvMs: z.number().int().nullable().optional(),
  hrv7dStatus: z.string().nullable().optional(),
  rawSource: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const customParameterRow = z.object({
  id: z.number().int(),
  name: z.string(),
  kind: z.string(),
  unit: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: z.string().optional(),
});

const customParameterValueRow = z.object({
  id: z.number().int(),
  parameterId: z.number().int(),
  date: z.string(),
  valueBool: z.boolean().nullable().optional(),
  valueInt: z.number().int().nullable().optional(),
  valueReal: z.number().nullable().optional(),
  valueText: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const trackerRow = z.object({
  id: z.number().int(),
  name: z.string(),
  kind: z.string(),
  notes: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  createdAt: z.string().optional(),
});

// Blob-stier fra backup'en skal ligne appens egne uploads — relative,
// under et kendt præfiks og uden '.'/'..'-segmenter. Ellers ville en
// fjendtlig backup.json kunne læse/slette vilkårlige filer via
// /api/files (path traversal). blobAbsolutePath har desuden et
// containment-tjek som anden forsvarslinje.
const blobPath = z
  .string()
  .max(500)
  .regex(/^(photos|documents|recipes)(\/[A-Za-z0-9._-]+)+$/)
  .refine((p) => p.split("/").every((seg) => seg !== "." && seg !== ".."), {
    message: "Ugyldig blob-sti",
  });

const photoRow = z.object({
  id: z.number().int(),
  trackerId: z.number().int().nullable().optional(),
  category: z.string(),
  bodyArea: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  blobUrl: blobPath,
  blobPathname: blobPath,
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  takenAt: z.string(),
  createdAt: z.string().optional(),
});

const documentRow = z.object({
  id: z.number().int(),
  kind: z.string(),
  title: z.string(),
  filename: z.string(),
  blobUrl: blobPath,
  blobPathname: blobPath,
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  extractedText: z.string().nullable().optional(),
  jobApplicationId: z.number().int().nullable().optional(),
  createdAt: z.string().optional(),
});

const jobSearchPeriodRow = z.object({
  id: z.number().int(),
  name: z.string().nullable().optional(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

const drinkSessionRow = z.object({
  id: z.number().int(),
  sessionDate: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

const drinkLogRow = z.object({
  id: z.number().int(),
  sessionId: z.number().int(),
  unitCount: z.number().int(),
  // Tiendedele (0039+); gamle backups udleder den af unitCount.
  unitsX10: z.number().int().optional(),
  kind: z.string(),
  occurredAt: z.string(),
});

const recipeRow = z.object({
  id: z.number().int(),
  title: z.string(),
  ingredients: z.string().optional().default(""),
  steps: z.string().optional().default(""),
  notes: z.string().nullable().optional(),
  servings: z.number().int().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  carbsG: z.number().int().nullable().optional(),
  proteinG: z.number().int().nullable().optional(),
  fatG: z.number().int().nullable().optional(),
  fiberG: z.number().int().nullable().optional(),
  imagePathname: blobPath.nullable().optional(),
  imageMime: z.string().nullable().optional(),
  shareToken: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const workoutRow = z.object({
  id: z.number().int(),
  date: z.string(),
  title: z.string(),
  durationMin: z.number().int().nullable().optional(),
  body: z.string().optional().default(""),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const workoutTemplateRow = z.object({
  id: z.number().int(),
  title: z.string(),
  durationMin: z.number().int().nullable().optional(),
  body: z.string().optional().default(""),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const planItemRow = z.object({
  id: z.number().int(),
  kind: z.enum(schema.PLAN_KINDS),
  projectId: z.number().int().nullable().optional(),
  supplementId: z.number().int().nullable().optional(),
  workoutTemplateId: z.number().int().nullable().optional(),
  label: z.string().nullable().optional(),
  scheduleType: z.enum(schema.PLAN_SCHEDULE_TYPES),
  weekdays: z.string().nullable().optional(),
  intervalDays: z.number().int().nullable().optional(),
  anchorDate: z.string().nullable().optional(),
  timeOfDay: z.string().nullable().optional(),
  minutesPlanned: z.number().int().nullable().optional(),
  doseTargetX100: z.number().int().nullable().optional(),
  doseUnit: z.string().nullable().optional(),
  kcalTarget: z.number().int().nullable().optional(),
  kcalMax: z.number().int().nullable().optional(),
  carbsTargetG: z.number().int().nullable().optional(),
  carbsMaxG: z.number().int().nullable().optional(),
  proteinTargetG: z.number().int().nullable().optional(),
  proteinMaxG: z.number().int().nullable().optional(),
  fatTargetG: z.number().int().nullable().optional(),
  fatMaxG: z.number().int().nullable().optional(),
  fiberTargetG: z.number().int().nullable().optional(),
  fiberMaxG: z.number().int().nullable().optional(),
  paused: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const planMarkRow = z.object({
  id: z.number().int(),
  planItemId: z.number().int(),
  date: z.string(),
  kind: z.string(),
  createdAt: z.string().optional(),
});

const planCheckinRow = z.object({
  id: z.number().int(),
  planItemId: z.number().int(),
  date: z.string(),
  at: z.string(),
  createdAt: z.string().optional(),
});

const goalRow = z.object({
  id: z.number().int(),
  title: z.string(),
  groupLabel: z.string().nullable().optional(),
  kind: z.enum(schema.GOAL_KINDS),
  targetValue: z.number().int().nullable().optional(),
  unit: z.string().nullable().optional(),
  startDate: z.string(),
  deadline: z.string(),
  note: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const goalEntryRow = z.object({
  id: z.number().int(),
  goalId: z.number().int(),
  date: z.string(),
  value: z.number().int(),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const backupSchema = z.object({
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
    sleepEntries: z.array(sleepEntryRow).optional().default([]),
    customParameters: z.array(customParameterRow).optional().default([]),
    customParameterValues: z
      .array(customParameterValueRow)
      .optional()
      .default([]),
    trackers: z.array(trackerRow).optional().default([]),
    photos: z.array(photoRow).optional().default([]),
    documents: z.array(documentRow).optional().default([]),
    jobSearchPeriods: z.array(jobSearchPeriodRow).optional().default([]),
    drinkSessions: z.array(drinkSessionRow).optional().default([]),
    drinkLogs: z.array(drinkLogRow).optional().default([]),
    recipes: z.array(recipeRow).optional().default([]),
    workouts: z.array(workoutRow).optional().default([]),
    workoutTemplates: z.array(workoutTemplateRow).optional().default([]),
    planItems: z.array(planItemRow).optional().default([]),
    planMarks: z.array(planMarkRow).optional().default([]),
    planCheckins: z.array(planCheckinRow).optional().default([]),
    goals: z.array(goalRow).optional().default([]),
    goalEntries: z.array(goalEntryRow).optional().default([]),
  }),
});

export type ParsedBackup = z.infer<typeof backupSchema>;

export type ImportFile = {
  path: string;
  data: Uint8Array;
};

export type ImportResult =
  | {
      ok: true;
      counts: Record<string, number>;
      filesWritten: number;
    }
  | { ok: false; error: string };

const nowIso = () => new Date().toISOString();

export async function performImport(
  uid: number,
  backup: ParsedBackup,
  files: ImportFile[],
): Promise<ImportResult> {
  const d = backup.data;

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

  const supplementIds = new Set(d.supplements.map((s) => s.id));
  for (const i of d.supplementIntakes) {
    if (i.supplementId !== null && !supplementIds.has(i.supplementId)) {
      return {
        ok: false,
        error:
          "Backup'en har et tilskuds-indtag uden tilhørende tilskud — afbrudt.",
      };
    }
  }

  // Hele nulstil+genindsæt kører i ÉN transaktion — et nedbrud midtvejs
  // ville ellers efterlade databasen halvt slettet i netop den feature,
  // hvis formål er datasikkerhed. Fil-skrivning sker først EFTER commit.
  await db.transaction(async (tx) => {
  // Slet eksisterende data (børn før forældre).
  const existingDrinkSessions = await tx
    .select({ id: schema.drinkSessions.id })
    .from(schema.drinkSessions)
    .where(eq(schema.drinkSessions.userId, uid));
  const existingDrinkSessionIds = existingDrinkSessions.map((s) => s.id);
  if (existingDrinkSessionIds.length > 0) {
    await tx
      .delete(schema.drinkLogs)
      .where(inArray(schema.drinkLogs.sessionId, existingDrinkSessionIds));
  }
  await tx.delete(schema.drinkSessions).where(eq(schema.drinkSessions.userId, uid));
  await tx.delete(schema.applicationEvents).where(eq(schema.applicationEvents.userId, uid));
  await tx.delete(schema.timeEntries).where(eq(schema.timeEntries.userId, uid));
  await tx.delete(schema.documents).where(eq(schema.documents.userId, uid));
  await tx.delete(schema.jobApplications).where(eq(schema.jobApplications.userId, uid));
  await tx.delete(schema.jobSearchPeriods).where(eq(schema.jobSearchPeriods.userId, uid));
  await tx.delete(schema.projects).where(eq(schema.projects.userId, uid));
  await tx.delete(schema.dayEntries).where(eq(schema.dayEntries.userId, uid));
  await tx.delete(schema.weekGoals).where(eq(schema.weekGoals.userId, uid));
  await tx.delete(schema.supplementIntakes).where(eq(schema.supplementIntakes.userId, uid));
  await tx.delete(schema.supplements).where(eq(schema.supplements.userId, uid));
  await tx.delete(schema.fasts).where(eq(schema.fasts.userId, uid));
  await tx.delete(schema.sleepEntries).where(eq(schema.sleepEntries.userId, uid));
  await tx.delete(schema.customParameterValues).where(eq(schema.customParameterValues.userId, uid));
  await tx.delete(schema.customParameters).where(eq(schema.customParameters.userId, uid));
  await tx.delete(schema.photos).where(eq(schema.photos.userId, uid));
  await tx.delete(schema.trackers).where(eq(schema.trackers.userId, uid));
  await tx.delete(schema.recipes).where(eq(schema.recipes.userId, uid));
  await tx.delete(schema.workouts).where(eq(schema.workouts.userId, uid));
  await tx.delete(schema.planCheckins).where(eq(schema.planCheckins.userId, uid));
  await tx.delete(schema.planMarks).where(eq(schema.planMarks.userId, uid));
  await tx.delete(schema.planItems).where(eq(schema.planItems.userId, uid));
  await tx.delete(schema.goalEntries).where(eq(schema.goalEntries.userId, uid));
  await tx.delete(schema.goals).where(eq(schema.goals.userId, uid));
  await tx
    .delete(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.userId, uid));

  // Lad SQLite generere nye autoincrement-id'er — backup-id'er kan
  // kollidere på tværs af brugere (PK er global, ikke per user).
  // For parent-tabeller indsætter vi én ad gangen og bygger map old→new.
  async function insertParent<R extends { id: number }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    rows: R[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toValues: (row: R) => any,
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    for (const row of rows) {
      const inserted = await tx
        .insert(table)
        .values(toValues(row))
        .returning({ id: table.id });
      const newId = (inserted[0] as { id: number }).id;
      map.set(row.id, newId);
    }
    return map;
  }

  const projectMap = await insertParent(schema.projects, d.projects, (p) => ({
    userId: uid,
    name: p.name,
    color: p.color ?? null,
    archived: p.archived ?? false,
    sortOrder: p.sortOrder ?? 0,
    createdAt: p.createdAt ?? nowIso(),
  }));

  const jobAppMap = await insertParent(
    schema.jobApplications,
    d.jobApplications,
    (a) => ({
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
    }),
  );

  const supplementMap = await insertParent(
    schema.supplements,
    d.supplements,
    (s) => ({
      userId: uid,
      name: s.name,
      defaultDoseAmountX100: s.defaultDoseAmountX100 ?? null,
      defaultDoseUnit: s.defaultDoseUnit ?? null,
      defaultTimeOfDay: s.defaultTimeOfDay ?? null,
      notes: s.notes ?? null,
      archived: s.archived ?? false,
      sortOrder: s.sortOrder ?? 0,
      createdAt: s.createdAt ?? nowIso(),
    }),
  );

  const customParamMap = await insertParent(
    schema.customParameters,
    d.customParameters,
    (p) => ({
      userId: uid,
      name: p.name,
      kind: p.kind,
      unit: p.unit ?? null,
      archived: p.archived ?? false,
      sortOrder: p.sortOrder ?? 0,
      createdAt: p.createdAt ?? nowIso(),
    }),
  );

  const trackerMap = await insertParent(schema.trackers, d.trackers, (t) => ({
    userId: uid,
    name: t.name,
    kind: t.kind,
    notes: t.notes ?? null,
    archived: t.archived ?? false,
    createdAt: t.createdAt ?? nowIso(),
  }));

  const drinkSessionMap = await insertParent(
    schema.drinkSessions,
    d.drinkSessions,
    (s) => ({
      userId: uid,
      sessionDate: s.sessionDate,
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? null,
      createdAt: s.createdAt ?? nowIso(),
    }),
  );

  // Parents uden børn — batch-insert uden eksplicit id.
  if (d.jobSearchPeriods.length > 0) {
    await tx.insert(schema.jobSearchPeriods).values(
      d.jobSearchPeriods.map((p) => ({
        userId: uid,
        name: p.name ?? null,
        startedAt: p.startedAt,
        endedAt: p.endedAt ?? null,
        createdAt: p.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.dayEntries.length > 0) {
    await tx.insert(schema.dayEntries).values(
      d.dayEntries.map((e) => ({
        userId: uid,
        date: e.date,
        mood: e.mood ?? null,
        energy: e.energy ?? null,
        sleepHours: e.sleepHours ?? null,
        sleepQuality:
          e.sleepQuality === null || e.sleepQuality === undefined
            ? null
            : Math.min(e.sleepQuality, 4),
        alcoholUnits: e.alcoholUnits ?? null,
        didExercise: e.didExercise ?? false,
        exerciseIntensity: e.exerciseIntensity ?? null,
        didFast: e.didFast ?? false,
        fastHoursX10: e.fastHoursX10 ?? null,
        fastBreakTime: e.fastBreakTime ?? null,
        weightX10: e.weightX10 ?? null,
        waistX10: e.waistX10 ?? null,
        carbsG: e.carbsG ?? null,
        proteinG: e.proteinG ?? null,
        fatG: e.fatG ?? null,
        fiberG: e.fiberG ?? null,
        workNotes: e.workNotes ?? null,
        healthNotes: e.healthNotes ?? null,
        dayNotes: e.dayNotes ?? null,
        wentWell: e.wentWell ?? null,
        nextStep: e.nextStep ?? null,
        applicationsTarget: e.applicationsTarget ?? null,
        focusHoursTargetX10: e.focusHoursTargetX10 ?? null,
        goalNote: e.goalNote ?? null,
        createdAt: e.createdAt ?? nowIso(),
        updatedAt: e.updatedAt ?? nowIso(),
      })),
    );
  }
  if (d.weekGoals.length > 0) {
    await tx.insert(schema.weekGoals).values(
      d.weekGoals.map((g) => ({
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
  if (d.fasts.length > 0) {
    await tx.insert(schema.fasts).values(
      d.fasts.map((f) => ({
        userId: uid,
        startedAt: f.startedAt,
        endedAt: f.endedAt ?? null,
        note: f.note ?? null,
        createdAt: f.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.sleepEntries.length > 0) {
    await tx.insert(schema.sleepEntries).values(
      d.sleepEntries.map((s) => ({
        userId: uid,
        date: s.date,
        source: s.source ?? "garmin",
        durationMin: s.durationMin ?? null,
        score: s.score ?? null,
        qualityLabel: s.qualityLabel ?? null,
        deepMin: s.deepMin ?? null,
        lightMin: s.lightMin ?? null,
        remMin: s.remMin ?? null,
        awakeMin: s.awakeMin ?? null,
        avgStress: s.avgStress ?? null,
        breathingVariation: s.breathingVariation ?? null,
        restlessMoments: s.restlessMoments ?? null,
        avgHeartRate: s.avgHeartRate ?? null,
        restingHeartRate: s.restingHeartRate ?? null,
        bodyBatteryChange: s.bodyBatteryChange ?? null,
        avgSpO2: s.avgSpO2 ?? null,
        lowestSpO2: s.lowestSpO2 ?? null,
        avgBreathingX10: s.avgBreathingX10 ?? null,
        lowestBreathingX10: s.lowestBreathingX10 ?? null,
        hrvMs: s.hrvMs ?? null,
        hrv7dStatus: s.hrv7dStatus ?? null,
        rawSource: s.rawSource ?? null,
        createdAt: s.createdAt ?? nowIso(),
        updatedAt: s.updatedAt ?? nowIso(),
      })),
    );
  }

  // Børn — oversæt foreign keys via parent-mapsene.
  if (d.timeEntries.length > 0) {
    const rows = d.timeEntries
      .map((t) => {
        const newProjectId = projectMap.get(t.projectId);
        if (newProjectId === undefined) return null;
        return {
          userId: uid,
          projectId: newProjectId,
          date: t.date,
          hoursX10: t.hoursX10,
          notes: t.notes ?? null,
          createdAt: t.createdAt ?? nowIso(),
          updatedAt: t.updatedAt ?? nowIso(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await tx.insert(schema.timeEntries).values(rows);
  }
  if (d.applicationEvents.length > 0) {
    const rows = d.applicationEvents
      .map((e) => {
        const newAppId = jobAppMap.get(e.applicationId);
        if (newAppId === undefined) return null;
        return {
          userId: uid,
          applicationId: newAppId,
          status: e.status,
          note: e.note ?? null,
          occurredAt: e.occurredAt,
          createdAt: e.createdAt ?? nowIso(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await tx.insert(schema.applicationEvents).values(rows);
  }
  if (d.supplementIntakes.length > 0) {
    // Ældre backups (før name-kolonnen) mangler navnet på rækken —
    // fald tilbage til skabelonens navn via FK'en.
    const suppNameById = new Map(d.supplements.map((s) => [s.id, s.name]));
    const rows = d.supplementIntakes
      .map((i) => {
        // null-FK bevares som null; ellers oversættes til det nye id.
        const newSuppId =
          i.supplementId === null ? null : supplementMap.get(i.supplementId);
        if (newSuppId === undefined) return null;
        const name =
          i.name.trim() ||
          (i.supplementId !== null
            ? (suppNameById.get(i.supplementId) ?? "")
            : "");
        return {
          userId: uid,
          name,
          supplementId: newSuppId,
          date: i.date,
          doseAmountX100: i.doseAmountX100 ?? null,
          doseUnit: i.doseUnit ?? null,
          timeOfDay: i.timeOfDay ?? null,
          note: i.note ?? null,
          createdAt: i.createdAt ?? nowIso(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0)
      await tx.insert(schema.supplementIntakes).values(rows);
  }
  if (d.customParameterValues.length > 0) {
    const rows = d.customParameterValues
      .map((v) => {
        const newParamId = customParamMap.get(v.parameterId);
        if (newParamId === undefined) return null;
        return {
          userId: uid,
          parameterId: newParamId,
          date: v.date,
          valueBool: v.valueBool ?? null,
          valueInt: v.valueInt ?? null,
          valueReal: v.valueReal ?? null,
          valueText: v.valueText ?? null,
          createdAt: v.createdAt ?? nowIso(),
          updatedAt: v.updatedAt ?? nowIso(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0)
      await tx.insert(schema.customParameterValues).values(rows);
  }
  if (d.photos.length > 0) {
    await tx.insert(schema.photos).values(
      d.photos.map((p) => ({
        userId: uid,
        trackerId:
          p.trackerId != null ? trackerMap.get(p.trackerId) ?? null : null,
        category: p.category,
        bodyArea: p.bodyArea ?? null,
        caption: p.caption ?? null,
        blobUrl: p.blobUrl,
        blobPathname: p.blobPathname,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        takenAt: p.takenAt,
        createdAt: p.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.documents.length > 0) {
    await tx.insert(schema.documents).values(
      d.documents.map((doc) => ({
        userId: uid,
        kind: doc.kind,
        title: doc.title,
        filename: doc.filename,
        blobUrl: doc.blobUrl,
        blobPathname: doc.blobPathname,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        extractedText: doc.extractedText ?? null,
        jobApplicationId:
          doc.jobApplicationId != null
            ? jobAppMap.get(doc.jobApplicationId) ?? null
            : null,
        createdAt: doc.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.drinkLogs.length > 0) {
    const rows = d.drinkLogs
      .map((l) => {
        const newSessionId = drinkSessionMap.get(l.sessionId);
        if (newSessionId === undefined) return null;
        return {
          sessionId: newSessionId,
          unitCount: l.unitCount,
          // Gamle backups (før 0039) har kun hele genstande.
          unitsX10: l.unitsX10 ?? l.unitCount * 10,
          kind: l.kind,
          occurredAt: l.occurredAt,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await tx.insert(schema.drinkLogs).values(rows);
  }
  if (d.recipes.length > 0) {
    await tx.insert(schema.recipes).values(
      d.recipes.map((r) => ({
        userId: uid,
        title: r.title,
        ingredients: r.ingredients,
        steps: r.steps,
        notes: r.notes ?? null,
        servings: r.servings ?? null,
        sourceUrl: r.sourceUrl ?? null,
        carbsG: r.carbsG ?? null,
        proteinG: r.proteinG ?? null,
        fatG: r.fatG ?? null,
        fiberG: r.fiberG ?? null,
        imagePathname: r.imagePathname ?? null,
        imageMime: r.imageMime ?? null,
        shareToken: r.shareToken ?? null,
        createdAt: r.createdAt ?? nowIso(),
        updatedAt: r.updatedAt ?? nowIso(),
      })),
    );
  }
  if (d.workouts.length > 0) {
    await tx.insert(schema.workouts).values(
      d.workouts.map((w) => ({
        userId: uid,
        date: w.date,
        title: w.title,
        durationMin: w.durationMin ?? null,
        body: w.body,
        createdAt: w.createdAt ?? nowIso(),
        updatedAt: w.updatedAt ?? nowIso(),
      })),
    );
  }
  // Skabeloner indsættes enkeltvis for id-map — plan_items refererer dem.
  const workoutTemplateMap = await insertParent(
    schema.workoutTemplates,
    d.workoutTemplates,
    (t) => ({
      userId: uid,
      title: t.title,
      durationMin: t.durationMin ?? null,
      body: t.body,
      createdAt: t.createdAt ?? nowIso(),
      updatedAt: t.updatedAt ?? nowIso(),
    }),
  );

  // Planlægger: FK'er oversættes via maps. Peger en FK på noget der ikke
  // findes i backup'en, bevares planen med null-FK (label er fallback).
  const planItemMap = new Map<number, number>();
  for (const p of d.planItems) {
    // Tilskuds-planer bindes via NAVN (label). Gamle backups (før 0036)
    // har FK i stedet — udled navn + dosis-mål fra backup'ens supplements.
    const legacySupp =
      p.kind === "supplement" && p.supplementId != null && !p.label
        ? d.supplements.find((s) => s.id === p.supplementId)
        : undefined;
    const inserted = await tx
      .insert(schema.planItems)
      .values({
        userId: uid,
        kind: p.kind,
        projectId:
          p.projectId != null ? (projectMap.get(p.projectId) ?? null) : null,
        supplementId: null,
        workoutTemplateId:
          p.workoutTemplateId != null
            ? (workoutTemplateMap.get(p.workoutTemplateId) ?? null)
            : null,
        label: p.label ?? legacySupp?.name ?? null,
        doseTargetX100:
          p.doseTargetX100 ?? legacySupp?.defaultDoseAmountX100 ?? null,
        doseUnit: p.doseUnit ?? legacySupp?.defaultDoseUnit ?? null,
        scheduleType: p.scheduleType,
        weekdays: p.weekdays ?? null,
        intervalDays: p.intervalDays ?? null,
        anchorDate: p.anchorDate ?? null,
        timeOfDay: p.timeOfDay ?? null,
        minutesPlanned: p.minutesPlanned ?? null,
        kcalTarget: p.kcalTarget ?? null,
        kcalMax: p.kcalMax ?? null,
        carbsTargetG: p.carbsTargetG ?? null,
        carbsMaxG: p.carbsMaxG ?? null,
        proteinTargetG: p.proteinTargetG ?? null,
        proteinMaxG: p.proteinMaxG ?? null,
        fatTargetG: p.fatTargetG ?? null,
        fatMaxG: p.fatMaxG ?? null,
        fiberTargetG: p.fiberTargetG ?? null,
        fiberMaxG: p.fiberMaxG ?? null,
        paused: p.paused ?? false,
        sortOrder: p.sortOrder ?? 0,
        createdAt: p.createdAt ?? nowIso(),
        updatedAt: p.updatedAt ?? nowIso(),
      })
      .returning({ id: schema.planItems.id });
    planItemMap.set(p.id, inserted[0].id);
  }
  if (d.planMarks.length > 0) {
    const rows = d.planMarks
      .map((m) => {
        const newItemId = planItemMap.get(m.planItemId);
        if (newItemId === undefined) return null;
        return {
          userId: uid,
          planItemId: newItemId,
          date: m.date,
          kind: m.kind,
          createdAt: m.createdAt ?? nowIso(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await tx.insert(schema.planMarks).values(rows);
  }

  if (d.planCheckins.length > 0) {
    const rows = d.planCheckins
      .map((c) => {
        const newItemId = planItemMap.get(c.planItemId);
        if (newItemId === undefined) return null;
        return {
          userId: uid,
          planItemId: newItemId,
          date: c.date,
          at: c.at,
          createdAt: c.createdAt ?? nowIso(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await tx.insert(schema.planCheckins).values(rows);
  }

  // Årsmål: entries mappes via nyt goal-id.
  const goalMap = new Map<number, number>();
  for (const g of d.goals) {
    const inserted = await tx
      .insert(schema.goals)
      .values({
        userId: uid,
        title: g.title,
        groupLabel: g.groupLabel ?? null,
        kind: g.kind,
        targetValue: g.targetValue ?? null,
        unit: g.unit ?? null,
        startDate: g.startDate,
        deadline: g.deadline,
        note: g.note ?? null,
        completedAt: g.completedAt ?? null,
        sortOrder: g.sortOrder ?? 0,
        createdAt: g.createdAt ?? nowIso(),
        updatedAt: g.updatedAt ?? nowIso(),
      })
      .returning({ id: schema.goals.id });
    goalMap.set(g.id, inserted[0].id);
  }
  if (d.goalEntries.length > 0) {
    const rows = d.goalEntries
      .map((e) => {
        const newGoalId = goalMap.get(e.goalId);
        if (newGoalId === undefined) return null;
        return {
          userId: uid,
          goalId: newGoalId,
          date: e.date,
          value: e.value,
          note: e.note ?? null,
          createdAt: e.createdAt ?? nowIso(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) await tx.insert(schema.goalEntries).values(rows);
  }

  });

  // Skriv binær fil-data fra ZIP'en til lokal disk.
  let filesWritten = 0;
  for (const f of files) {
    if (!/^(photos|documents|recipes)\//.test(f.path)) continue;
    if (f.path.includes("..")) continue;
    const absolutePath = join(BLOB_ROOT, f.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, f.data);
    filesWritten += 1;
  }

  for (const path of [
    "/",
    "/today",
    "/jobs",
    "/projects",
    "/health",
    "/health/photos",
    "/health/trackere",
    "/documents",
    "/journal",
    "/opskrifter",
    "/statistik",
    "/settings",
  ]) {
    revalidatePath(path);
  }

  return {
    ok: true,
    counts: {
      dayEntries: d.dayEntries.length,
      projects: d.projects.length,
      timeEntries: d.timeEntries.length,
      jobApplications: d.jobApplications.length,
      jobSearchPeriods: d.jobSearchPeriods.length,
      applicationEvents: d.applicationEvents.length,
      weekGoals: d.weekGoals.length,
      supplements: d.supplements.length,
      supplementIntakes: d.supplementIntakes.length,
      fasts: d.fasts.length,
      drinkSessions: d.drinkSessions.length,
      drinkLogs: d.drinkLogs.length,
      sleepEntries: d.sleepEntries.length,
      customParameters: d.customParameters.length,
      customParameterValues: d.customParameterValues.length,
      trackers: d.trackers.length,
      photos: d.photos.length,
      documents: d.documents.length,
      recipes: d.recipes.length,
      workouts: d.workouts.length,
      workoutTemplates: d.workoutTemplates.length,
      planItems: d.planItems.length,
      planMarks: d.planMarks.length,
    },
    filesWritten,
  };
}
