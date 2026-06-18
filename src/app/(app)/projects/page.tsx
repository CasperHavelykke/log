import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { getAllProjects, getAllTimeEntries } from "@/lib/queries";
import { todayIsoDate } from "@/lib/date";
import { ProjectsPage } from "./projects-page";
import { ReflectionCard } from "./reflection-card";

export const metadata = { title: "Projekter | Log" };

export default async function Projects() {
  const user = await requireUser();
  const date = todayIsoDate();
  const [projects, timeEntries, todayEntry] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <ProjectsPage
        focusProjectId={user.focusProjectId}
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
      <div className="mx-auto max-w-[1100px] px-4">
        <ReflectionCard
          date={date}
          initialWorkNotes={todayEntry?.workNotes ?? ""}
          initialWentWell={todayEntry?.wentWell ?? ""}
          initialNextStep={todayEntry?.nextStep ?? ""}
        />
      </div>
    </div>
  );
}
