import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { listDocuments } from "../../documents/actions";
import { JobDetailClient } from "./job-detail-client";
import type { JobStatus } from "@/db/schema";

export const metadata = { title: "Ansøgning | Log" };

type Params = Promise<{ id: string }>;

export default async function JobDetail({ params }: { params: Params }) {
  const user = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const rows = await db
    .select()
    .from(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.id, id),
        eq(schema.jobApplications.userId, user.id),
      ),
    )
    .limit(1);
  const app = rows[0];
  if (!app) notFound();

  const eventRows = await db
    .select()
    .from(schema.applicationEvents)
    .where(eq(schema.applicationEvents.applicationId, id))
    .orderBy(asc(schema.applicationEvents.occurredAt));

  const allDocs = await listDocuments();
  const attached = allDocs.filter((d) => d.jobApplicationId === id);
  const unattached = allDocs
    .filter((d) => d.jobApplicationId === null)
    .map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      filename: d.filename,
      mimeType: d.mimeType,
    }));

  return (
    <JobDetailClient
      app={{
        id: app.id,
        company: app.company,
        role: app.role ?? "",
        status: app.status as JobStatus,
        files: app.files ?? "",
        url: app.url ?? "",
        contactPerson: app.contactPerson ?? "",
        notes: app.notes ?? "",
        applicationText: app.applicationText ?? "",
        sentAt: app.sentAt ?? "",
        updatedAt: app.updatedAt,
      }}
      events={eventRows.map((e) => ({
        id: e.id,
        status: e.status as JobStatus,
        occurredAt: e.occurredAt,
        note: e.note ?? null,
      }))}
      documents={attached.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        filename: d.filename,
        mimeType: d.mimeType,
      }))}
      unattached={unattached}
    />
  );
}
