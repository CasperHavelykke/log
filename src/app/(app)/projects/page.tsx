import { requireUser } from "@/lib/session";
import { getAllProjects, getAllTimeEntries } from "@/lib/queries";
import { ProjectsPage } from "./projects-page";

export const metadata = { title: "Projekter | Log" };

export default async function Projects() {
  const user = await requireUser();
  const [projects, timeEntries] = await Promise.all([
    getAllProjects(user.id),
    getAllTimeEntries(user.id),
  ]);

  return (
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
  );
}
