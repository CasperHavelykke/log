import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { getAllProjects, getAllTimeEntries, getWeekGoal } from "@/lib/queries";
import { todayIsoDate, mondayOf } from "@/lib/date";
import { ProjectsPage } from "./projects-page";

export const metadata = { title: "Projekter | Log" };

export default async function Projects() {
  const user = await requireUser();
  const date = todayIsoDate();
  const weekStart = mondayOf(new Date());
  const [projects, timeEntries, todayEntry, weekGoal] = await Promise.all([
    getAllProjects(user.id),
    getAllTimeEntries(user.id),
    db
      .select()
      .from(schema.dayEntries)
      .where(
        and(
          eq(schema.dayEntries.userId, user.id),
          eq(schema.dayEntries.date, date),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getWeekGoal(user.id, weekStart),
  ]);

  return (
    <ProjectsPage
      focusProjectId={user.focusProjectId}
      weekStart={weekStart}
      weekFocusTargetX10={weekGoal?.focusHoursTargetX10 ?? null}
      reflectionInitial={{
        date,
        workNotes: todayEntry?.workNotes ?? "",
        wentWell: todayEntry?.wentWell ?? "",
        nextStep: todayEntry?.nextStep ?? "",
      }}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        archived: p.archived,
      }))}
      entries={timeEntries.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        date: t.date,
        hoursX10: t.hoursX10,
        notes: t.notes ?? "",
      }))}
    />
  );
}
