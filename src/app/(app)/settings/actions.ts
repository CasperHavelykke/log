"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

// --- import -----------------------------------------------------------------

// dayEntryRow accepterer både v1 (med headache/iskiasPain osv.) og v2.
// De gamle felter ignoreres ved insert siden de er flyttet til
// custom_parameter_values.
const dayEntryRow = z.object({
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
}).passthrough(); // tillad legacy felter (headache, iskiasPain m.fl.) uden at fejle

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

const photoRow = z.object({
  id: z.number().int(),
  trackerId: z.number().int().nullable().optional(),
  category: z.string(),
  bodyArea: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  blobUrl: z.string(),
  blobPathname: z.string(),
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
  blobUrl: z.string(),
  blobPathname: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  extractedText: z.string().nullable().optional(),
  jobApplicationId: z.number().int().nullable().optional(),
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
    // Nye i v2 — alle optional for backward compat med v1-backups
    sleepEntries: z.array(sleepEntryRow).optional().default([]),
    customParameters: z.array(customParameterRow).optional().default([]),
    customParameterValues: z
      .array(customParameterValueRow)
      .optional()
      .default([]),
    trackers: z.array(trackerRow).optional().default([]),
    photos: z.array(photoRow).optional().default([]),
    documents: z.array(documentRow).optional().default([]),
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
  await db.delete(schema.documents).where(eq(schema.documents.userId, uid));
  await db.delete(schema.jobApplications).where(eq(schema.jobApplications.userId, uid));
  await db.delete(schema.projects).where(eq(schema.projects.userId, uid));
  await db.delete(schema.dayEntries).where(eq(schema.dayEntries.userId, uid));
  await db.delete(schema.weekGoals).where(eq(schema.weekGoals.userId, uid));
  await db.delete(schema.supplementIntakes).where(eq(schema.supplementIntakes.userId, uid));
  await db.delete(schema.supplements).where(eq(schema.supplements.userId, uid));
  await db.delete(schema.fasts).where(eq(schema.fasts.userId, uid));
  await db.delete(schema.sleepEntries).where(eq(schema.sleepEntries.userId, uid));
  await db.delete(schema.customParameterValues).where(eq(schema.customParameterValues.userId, uid));
  await db.delete(schema.customParameters).where(eq(schema.customParameters.userId, uid));
  await db.delete(schema.photos).where(eq(schema.photos.userId, uid));
  await db.delete(schema.trackers).where(eq(schema.trackers.userId, uid));

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

  // --- v2-tabeller ---
  if (d.sleepEntries.length > 0) {
    await db.insert(schema.sleepEntries).values(
      d.sleepEntries.map((s) => ({
        id: s.id,
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
  if (d.customParameters.length > 0) {
    await db.insert(schema.customParameters).values(
      d.customParameters.map((p) => ({
        id: p.id,
        userId: uid,
        name: p.name,
        kind: p.kind,
        unit: p.unit ?? null,
        archived: p.archived ?? false,
        sortOrder: p.sortOrder ?? 0,
        createdAt: p.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.customParameterValues.length > 0) {
    const paramIds = new Set(d.customParameters.map((p) => p.id));
    const validValues = d.customParameterValues.filter((v) =>
      paramIds.has(v.parameterId),
    );
    if (validValues.length > 0) {
      await db.insert(schema.customParameterValues).values(
        validValues.map((v) => ({
          id: v.id,
          userId: uid,
          parameterId: v.parameterId,
          date: v.date,
          valueBool: v.valueBool ?? null,
          valueInt: v.valueInt ?? null,
          valueReal: v.valueReal ?? null,
          valueText: v.valueText ?? null,
          createdAt: v.createdAt ?? nowIso(),
          updatedAt: v.updatedAt ?? nowIso(),
        })),
      );
    }
  }
  if (d.trackers.length > 0) {
    await db.insert(schema.trackers).values(
      d.trackers.map((t) => ({
        id: t.id,
        userId: uid,
        name: t.name,
        kind: t.kind,
        notes: t.notes ?? null,
        archived: t.archived ?? false,
        createdAt: t.createdAt ?? nowIso(),
      })),
    );
  }
  if (d.photos.length > 0) {
    const trackerIds = new Set(d.trackers.map((t) => t.id));
    await db.insert(schema.photos).values(
      d.photos.map((p) => ({
        id: p.id,
        userId: uid,
        // Hvis tracker-ID'et i backup'en ikke eksisterer, sæt til null
        trackerId:
          p.trackerId != null && trackerIds.has(p.trackerId)
            ? p.trackerId
            : null,
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
    const appIdsSet = new Set(d.jobApplications.map((a) => a.id));
    await db.insert(schema.documents).values(
      d.documents.map((doc) => ({
        id: doc.id,
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
          doc.jobApplicationId != null && appIdsSet.has(doc.jobApplicationId)
            ? doc.jobApplicationId
            : null,
        createdAt: doc.createdAt ?? nowIso(),
      })),
    );
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
      applicationEvents: d.applicationEvents.length,
      weekGoals: d.weekGoals.length,
      supplements: d.supplements.length,
      supplementIntakes: d.supplementIntakes.length,
      fasts: d.fasts.length,
      sleepEntries: d.sleepEntries.length,
      customParameters: d.customParameters.length,
      customParameterValues: d.customParameterValues.length,
      trackers: d.trackers.length,
      photos: d.photos.length,
      documents: d.documents.length,
    },
  };
}
