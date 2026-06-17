import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { PhotosListClient } from "./photos-list-client";

export const metadata = { title: "Fotos | Log" };

export default async function PhotosPage() {
  const user = await requireUser();

  const [photos, trackers] = await Promise.all([
    db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.userId, user.id))
      .orderBy(desc(schema.photos.takenAt)),
    db
      .select()
      .from(schema.trackers)
      .where(eq(schema.trackers.userId, user.id)),
  ]);

  return (
    <PhotosListClient
      initialPhotos={photos.map((p) => ({
        id: p.id,
        trackerId: p.trackerId,
        caption: p.caption,
        takenAt: p.takenAt,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
      }))}
      trackers={trackers.map((t) => ({ id: t.id, name: t.name, kind: t.kind }))}
    />
  );
}
