import { notFound } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { getTracker, listTrackerPhotos } from "../actions";
import { TrackerDetailClient } from "./tracker-detail-client";

export const metadata = { title: "Tracker | Log" };

type Params = Promise<{ id: string }>;

export default async function TrackerDetailPage({
  params,
}: {
  params: Params;
}) {
  const user = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const tracker = await getTracker(id);
  if (!tracker) notFound();

  const photos = await listTrackerPhotos(id);

  let metricData: { date: string; value: number }[] = [];
  if (tracker.kind === "weight" || tracker.kind === "waist") {
    const column =
      tracker.kind === "weight"
        ? schema.dayEntries.weightX10
        : schema.dayEntries.waistX10;
    const rows = await db
      .select({ date: schema.dayEntries.date, value: column })
      .from(schema.dayEntries)
      .where(and(eq(schema.dayEntries.userId, user.id), isNotNull(column)));
    metricData = rows
      .filter((r): r is { date: string; value: number } => r.value !== null)
      .map((r) => ({ date: r.date, value: r.value / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } else if (tracker.kind === "dermatitis" || tracker.kind === "staph") {
    const column =
      tracker.kind === "dermatitis"
        ? schema.dayEntries.seborrheicDermatitis
        : schema.dayEntries.staph;
    const rows = await db
      .select({ date: schema.dayEntries.date, value: column })
      .from(schema.dayEntries)
      .where(and(eq(schema.dayEntries.userId, user.id), isNotNull(column)));
    metricData = rows
      .filter((r): r is { date: string; value: number } => r.value !== null)
      .map((r) => ({ date: r.date, value: r.value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <TrackerDetailClient
      tracker={{
        id: tracker.id,
        name: tracker.name,
        kind: tracker.kind,
        notes: tracker.notes,
        archived: tracker.archived,
      }}
      initialPhotos={photos.map((p) => ({
        id: p.id,
        caption: p.caption,
        takenAt: p.takenAt,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
      }))}
      metricData={metricData}
    />
  );
}
