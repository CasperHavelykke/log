import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { listTrackers } from "./actions";
import { TrackersListClient } from "./trackers-list-client";

export const metadata = { title: "Trackere | Log" };

export default async function TrackersListPage() {
  const user = await requireUser();
  const trackers = await listTrackers(true);

  const counts = await db
    .select({
      trackerId: schema.photos.trackerId,
      count: sql<number>`count(*)`,
      latestTaken: sql<string>`max(${schema.photos.takenAt})`,
    })
    .from(schema.photos)
    .where(eq(schema.photos.userId, user.id))
    .groupBy(schema.photos.trackerId);

  const countMap = new Map<number, { count: number; latest: string }>();
  for (const c of counts) {
    if (c.trackerId !== null) {
      countMap.set(c.trackerId, {
        count: Number(c.count),
        latest: c.latestTaken,
      });
    }
  }

  return (
    <TrackersListClient
      initialTrackers={trackers.map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
        notes: t.notes,
        archived: t.archived,
        createdAt: t.createdAt,
        photoCount: countMap.get(t.id)?.count ?? 0,
        latestTaken: countMap.get(t.id)?.latest ?? null,
      }))}
    />
  );
}
