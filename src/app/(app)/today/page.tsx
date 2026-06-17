import { and, eq } from "drizzle-orm";
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
  getWeekGoal,
} from "@/lib/queries";
import { mondayOf, todayIsoDate, toIsoDate } from "@/lib/date";
import { listDocuments } from "../documents/actions";
import { listTrackers } from "../health/trackere/actions";
import {
  listCustomParameters,
  listCustomValuesForDate,
} from "@/lib/custom-parameters";
import { TodayPage } from "./today-form";

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
    getWeekGoal(user.id, weekStart),
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
  ] = await Promise.all([
    getActiveSupplements(user.id),
    getSupplementIntakesOnDate(user.id, date),
    getActiveFast(user.id),
    getRecentFasts(user.id, 5),
    listDocuments(),
    listTrackers(false),
    listCustomParameters(false),
    listCustomValuesForDate(date),
  ]);

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

  return (
    <TodayPage
      date={date}
      weekStart={weekStart}
      weekAppsCount={weekAppsCount}
      weekHoursX10={weekHoursX10}
      initialWeekGoal={{
        text: weekGoal?.text ?? "",
        applicationsTarget: weekGoal?.applicationsTarget ?? null,
        focusHoursTargetX10: weekGoal?.focusHoursTargetX10 ?? null,
      }}
      initialDayGoals={{
        applicationsTarget: entry?.applicationsTarget ?? null,
        focusHoursTargetX10: entry?.focusHoursTargetX10 ?? null,
        goalNote: entry?.goalNote ?? "",
      }}
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
      trackers={trackers.map((t) => ({ id: t.id, name: t.name, kind: t.kind }))}
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
