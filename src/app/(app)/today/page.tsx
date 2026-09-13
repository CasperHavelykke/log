import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import {
  getActiveProjects,
  getActiveFast,
  getActiveSupplements,
  getRecentFasts,
  getAllJobApplications,
  getApplicationsSentOn,
  getDayEntry,
  getSupplementIntakesOnDate,
  getTimeEntriesInRange,
  getEffectiveWeekGoal,
} from "@/lib/queries";
import { mondayOf, todayIsoDate, toIsoDate } from "@/lib/date";
import { listDocuments } from "../documents/actions";
import { listTrackersWithPhotoStats } from "../health/trackere/actions";
import { getActiveJobSearchPeriod } from "../jobs/period-actions";
import {
  listCustomParameters,
  listCustomValuesForDate,
} from "@/lib/custom-parameters";
import { TodayPage } from "./today-form";
import {
  hasIntakeWithName,
  occursOn,
  sumSupplementDoseByNameX100,
  toPlanItemData,
} from "@/lib/plan";
import { dayKcal } from "@/lib/kcal";
import type { TodayPlanEntry } from "./today-plan-card";

export const metadata = { title: "Log" };

export default async function Today() {
  const user = await requireUser();
  const date = todayIsoDate();
  const weekStart = mondayOf(new Date(date));
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = toIsoDate(weekEndDate);
  const yesterdayDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toIsoDate(d);
  })();

  const [
    entry,
    weekGoal,
    projects,
    todaysApps,
    allApps,
    weekTime,
    sleepRow,
    yesterdayEntry,
  ] = await Promise.all([
    getDayEntry(user.id, date),
    getEffectiveWeekGoal(user.id, weekStart),
    getActiveProjects(user.id),
    getApplicationsSentOn(user.id, date),
    getAllJobApplications(user.id),
    getTimeEntriesInRange(user.id, weekStart, weekEnd),
    db
      .select()
      .from(schema.sleepEntries)
      .where(
        and(
          eq(schema.sleepEntries.userId, user.id),
          eq(schema.sleepEntries.date, date),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getDayEntry(user.id, yesterdayDate),
  ]);

  const [
    supplements,
    todaysIntakes,
    activeFast,
    recentFasts,
    allDocs,
    trackers,
    customParameters,
    customValues,
    activePeriod,
  ] = await Promise.all([
    getActiveSupplements(user.id),
    getSupplementIntakesOnDate(user.id, date),
    getActiveFast(user.id),
    getRecentFasts(user.id, 5),
    listDocuments(),
    listTrackersWithPhotoStats(),
    listCustomParameters(false),
    listCustomValuesForDate(date),
    getActiveJobSearchPeriod(),
  ]);
  const hasActiveJobPeriod = activePeriod !== null;

  const docsByApp = new Map<number, typeof allDocs>();
  for (const d of allDocs) {
    if (d.jobApplicationId !== null) {
      const list = docsByApp.get(d.jobApplicationId) ?? [];
      list.push(d);
      docsByApp.set(d.jobApplicationId, list);
    }
  }
  const unattachedDocs = allDocs
    .filter((d) => d.jobApplicationId === null)
    .map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      filename: d.filename,
      mimeType: d.mimeType,
    }));

  const yesterdayNextStep = yesterdayEntry?.nextStep?.trim() || "";

  const weekAppsCount = allApps.filter(
    (a) => a.sentAt && a.sentAt >= weekStart && a.sentAt <= weekEnd,
  ).length;
  const weekHoursX10 = weekTime.reduce((sum, t) => sum + t.hoursX10, 0);

  const focusProjectId =
    user.focusProjectId &&
    projects.find((p) => p.id === user.focusProjectId)
      ? user.focusProjectId
      : (projects[0]?.id ?? null);

  const todaysTimeEntries = weekTime
    .filter((t) => t.date === date)
    .map((t) => ({
      id: t.id,
      projectId: t.projectId,
      hoursX10: t.hoursX10,
      notes: t.notes ?? "",
    }));

  // --- Dagens plan ----------------------------------------------------------
  const [planItemsRows, planMarksRows, workoutsToday, allTemplates] =
    await Promise.all([
      db
        .select()
        .from(schema.planItems)
        .where(eq(schema.planItems.userId, user.id)),
      db
        .select()
        .from(schema.planMarks)
        .where(
          and(
            eq(schema.planMarks.userId, user.id),
            eq(schema.planMarks.date, date),
          ),
        ),
      (user.trainingEnabled ?? false)
        ? db
            .select({ id: schema.workouts.id })
            .from(schema.workouts)
            .where(
              and(
                eq(schema.workouts.userId, user.id),
                eq(schema.workouts.date, date),
              ),
            )
        : Promise.resolve([] as { id: number }[]),
      db
        .select()
        .from(schema.workoutTemplates)
        .where(eq(schema.workoutTemplates.userId, user.id)),
    ]);

  const marksByItem = new Map(planMarksRows.map((m) => [m.planItemId, m.kind]));
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const templatesById = new Map(allTemplates.map((t) => [t.id, t]));
  const dayK = dayKcal({
    carbsG: entry?.carbsG ?? null,
    proteinG: entry?.proteinG ?? null,
    fatG: entry?.fatG ?? null,
    fiberG: entry?.fiberG ?? null,
    alcoholUnits: entry?.alcoholUnits ?? null,
  });

  const kindOrder: Record<string, number> = {
    supplement: 0,
    training: 1,
    meal: 2,
    project: 3,
    nutrition: 4,
  };
  const planEntries: TodayPlanEntry[] = planItemsRows
    .filter((i) => occursOn(i, date))
    .sort(
      (a, b) =>
        (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
        a.sortOrder - b.sortOrder ||
        a.id - b.id,
    )
    .map((i) => {
      let title = i.label ?? "";
      const doseText: string | null = null;
      let doseProgress: TodayPlanEntry["doseProgress"] = null;
      if (i.kind === "supplement") {
        // Navne-binding: alle dagens indtag med navnet tæller, uanset
        // hvilken chip/genvej/AI der loggede dem. Målet er planens eget.
        title = i.label ?? "Tilskud";
        if (i.doseTargetX100 !== null) {
          doseProgress = {
            doneX100: sumSupplementDoseByNameX100(
              todaysIntakes,
              title,
              i.doseTargetX100,
              i.doseUnit,
            ),
            targetX100: i.doseTargetX100,
            unit: i.doseUnit,
          };
        }
      } else if (i.kind === "project") {
        const p = i.projectId !== null ? projectsById.get(i.projectId) : undefined;
        title = p?.name ?? i.label ?? "Projekt";
      } else if (i.kind === "training") {
        const t =
          i.workoutTemplateId !== null
            ? templatesById.get(i.workoutTemplateId)
            : undefined;
        title = t?.title ?? i.label ?? "Træning";
      } else if (i.kind === "nutrition") {
        title = i.label ?? "Dagens mål";
      }

      // hoursX10 → minutter: ×10-timer × 6.
      const minutesActual =
        i.kind === "project" && i.projectId !== null
          ? Math.round(
              todaysTimeEntries
                .filter((t) => t.projectId === i.projectId)
                .reduce((sum, t) => sum + t.hoursX10, 0) * 6,
            )
          : null;

      const mark = marksByItem.get(i.id);
      let state: TodayPlanEntry["state"] =
        mark === "skip" ? "skipped" : mark === "done" ? "done" : "open";
      if (state === "open") {
        if (i.kind === "supplement") {
          // Med dosis-mål: klaret først når summen når målet.
          // Uden mål: binært — ét indtag med navnet tæller.
          if (doseProgress !== null) {
            if (doseProgress.doneX100 >= doseProgress.targetX100) {
              state = "done";
            }
          } else if (hasIntakeWithName(todaysIntakes, title)) {
            state = "done";
          }
        } else if (
          i.kind === "training" &&
          (workoutsToday.length > 0 || (entry?.didExercise ?? false))
        ) {
          state = "done";
        } else if (
          i.kind === "project" &&
          i.minutesPlanned !== null &&
          (minutesActual ?? 0) >= i.minutesPlanned
        ) {
          state = "done";
        }
      }

      return {
        id: i.id,
        kind: i.kind as TodayPlanEntry["kind"],
        title,
        timeOfDay: i.timeOfDay,
        state,
        supplementName: i.kind === "supplement" ? title : null,
        doseText,
        doseProgress,
        workoutTemplateId: i.workoutTemplateId,
        minutesPlanned: i.minutesPlanned,
        minutesActual,
        targets:
          i.kind === "nutrition"
            ? {
                kcal: i.kcalTarget,
                carbs: i.carbsTargetG,
                protein: i.proteinTargetG,
                fat: i.fatTargetG,
                fiber: i.fiberTargetG,
              }
            : null,
        actuals:
          i.kind === "nutrition"
            ? {
                kcal: dayK.totalKcal,
                carbs: entry?.carbsG ?? null,
                protein: entry?.proteinG ?? null,
                fat: entry?.fatG ?? null,
                fiber: entry?.fiberG ?? null,
              }
            : null,
      };
    });

  return (
    <TodayPage
      date={date}
      weekStart={weekStart}
      weekAppsCount={weekAppsCount}
      weekHoursX10={weekHoursX10}
      initialWeekGoal={{
        text: weekGoal.text ?? "",
        applicationsTarget: weekGoal.applicationsTarget,
        focusHoursTargetX10: weekGoal.focusHoursTargetX10,
      }}
      initialDayGoals={{
        applicationsTarget: entry?.applicationsTarget ?? null,
        focusHoursTargetX10: entry?.focusHoursTargetX10 ?? null,
        goalNote: await resolveGoalNote(user.id, date, entry?.goalNote),
      }}
      planEntries={planEntries}
      supplementPlans={planItemsRows
        .filter((i) => i.kind === "supplement")
        .map(toPlanItemData)}
      nutritionPlans={planItemsRows
        .filter((i) => i.kind === "nutrition" || i.kind === "meal")
        .map(toPlanItemData)}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      initialFocusProjectId={focusProjectId}
      initialTimeEntries={todaysTimeEntries}
      yesterdayNextStep={yesterdayNextStep}
      supplements={supplements.map((s) => ({
        id: s.id,
        name: s.name,
        defaultDoseAmountX100: s.defaultDoseAmountX100,
        defaultDoseUnit: s.defaultDoseUnit,
        defaultTimeOfDay: s.defaultTimeOfDay as
          | "morning"
          | "midday"
          | "evening"
          | "night"
          | null,
        archived: s.archived,
      }))}
      activeFast={
        activeFast
          ? {
              id: activeFast.id,
              startedAt: activeFast.startedAt,
              note: activeFast.note,
            }
          : null
      }
      recentFasts={recentFasts.map((f) => ({
        id: f.id,
        startedAt: f.startedAt,
        endedAt: f.endedAt,
        note: f.note,
      }))}
      fasteEnabled={user.fasteEnabled ?? false}
      garminSleepEnabled={user.garminSleepEnabled ?? false}
      hasActiveJobPeriod={hasActiveJobPeriod}
      initialSupplementIntakes={todaysIntakes.map((i) => ({
        id: i.id,
        name: i.name,
        supplementId: i.supplementId,
        doseAmountX100: i.doseAmountX100,
        doseUnit: i.doseUnit,
        timeOfDay: i.timeOfDay as
          | "morning"
          | "midday"
          | "evening"
          | "night"
          | null,
        note: i.note,
      }))}
      garminSleep={
        sleepRow
          ? {
              durationMin: sleepRow.durationMin,
              score: sleepRow.score,
              qualityLabel: sleepRow.qualityLabel,
            }
          : null
      }
      initialApplications={todaysApps.map((a) => ({
        id: a.id,
        company: a.company,
        role: a.role ?? "",
        files: a.files ?? "",
        status: a.status as
          | "sent"
          | "replied"
          | "interview"
          | "offer"
          | "rejected"
          | "withdrawn",
        documents: (docsByApp.get(a.id) ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          kind: d.kind,
          filename: d.filename,
          mimeType: d.mimeType,
        })),
      }))}
      unattachedDocuments={unattachedDocs}
      trackers={trackers}
      customParameters={customParameters}
      customValues={customValues}
      initialDay={{
        mood: entry?.mood ?? null,
        energy: entry?.energy ?? null,
        sleepHoursX10: entry?.sleepHours ?? null,
        sleepQuality: entry?.sleepQuality ?? null,
        alcoholUnits: entry?.alcoholUnits ?? null,
        didExercise: entry?.didExercise ?? false,
        exerciseIntensity:
          (entry?.exerciseIntensity as "light" | "medium" | "hard" | null) ?? null,
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
      }}
      lastSavedAt={entry?.updatedAt ?? null}
    />
  );
}

// Hvis dagens day_entry endnu ikke har et goalNote sat (null), fald tilbage
// til det seneste mål brugeren har skrevet i en tidligere dag. Tom streng ""
// betyder at brugeren bevidst har ryddet feltet i dag → respekter det.
async function resolveGoalNote(
  userId: number,
  today: string,
  todaysGoalNote: string | null | undefined,
): Promise<string> {
  if (todaysGoalNote !== null && todaysGoalNote !== undefined) {
    return todaysGoalNote;
  }
  const rows = await db
    .select({ goalNote: schema.dayEntries.goalNote })
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, userId),
        lt(schema.dayEntries.date, today),
        isNotNull(schema.dayEntries.goalNote),
      ),
    )
    .orderBy(desc(schema.dayEntries.date))
    .limit(1);
  return rows[0]?.goalNote ?? "";
}

