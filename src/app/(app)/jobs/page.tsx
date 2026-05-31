import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { getAllApplicationEvents, getAllJobApplications } from "@/lib/queries";
import { JobsPage } from "./jobs-page";
import type { JobStatus } from "@/db/schema";

export const metadata = { title: "Job | Log" };

/**
 * Markerer "Sendt"-ansøgninger som "Intet svar" hvis de ikke er rørt i en uge.
 * Kører hver gang /jobs indlæses. Et event tilføjes så tidslinjen viser
 * overgangen. Tidsgrundlag: applikationens updatedAt (så manuelle ændringer
 * tilbage til 'sent' nulstiller uret indtil næste uge).
 */
async function flagStaleSentApplications(userId: number) {
  const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();
  const now = new Date().toISOString();
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const stale = await db
    .select()
    .from(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.userId, userId),
        eq(schema.jobApplications.status, "sent"),
        lt(schema.jobApplications.updatedAt, cutoffIso),
      ),
    );

  for (const app of stale) {
    await db
      .update(schema.jobApplications)
      .set({ status: "no_response", updatedAt: now })
      .where(eq(schema.jobApplications.id, app.id));
    await db.insert(schema.applicationEvents).values({
      userId,
      applicationId: app.id,
      status: "no_response",
      occurredAt: today,
      note: "Auto: intet svar efter 1 uge",
    });
  }
}

export default async function Jobs() {
  const user = await requireUser();
  await flagStaleSentApplications(user.id);
  const [apps, events] = await Promise.all([
    getAllJobApplications(user.id),
    getAllApplicationEvents(user.id),
  ]);
  return (
    <JobsPage
      initial={apps.map((a) => ({
        id: a.id,
        company: a.company,
        role: a.role ?? "",
        status: a.status as JobStatus,
        files: a.files ?? "",
        url: a.url ?? "",
        contactPerson: a.contactPerson ?? "",
        notes: a.notes ?? "",
        applicationText: a.applicationText ?? "",
        sentAt: a.sentAt ?? "",
        updatedAt: a.updatedAt,
      }))}
      events={events.map((e) => ({
        id: e.id,
        applicationId: e.applicationId,
        status: e.status as JobStatus,
        occurredAt: e.occurredAt,
      }))}
    />
  );
}
