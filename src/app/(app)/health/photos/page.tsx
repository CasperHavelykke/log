import { requireUser } from "@/lib/session";
import { listBodyAreas, listPhotos } from "./actions";
import { PhotosClient } from "./photos-client";

export const metadata = { title: "Billeder | Log" };

export default async function PhotosPage() {
  await requireUser();
  const [photos, bodyAreas] = await Promise.all([
    listPhotos(),
    listBodyAreas(),
  ]);
  return (
    <PhotosClient
      initialPhotos={photos.map((p) => ({
        id: p.id,
        category: p.category,
        bodyArea: p.bodyArea,
        caption: p.caption,
        blobUrl: p.blobUrl,
        takenAt: p.takenAt,
        sizeBytes: p.sizeBytes,
      }))}
      knownBodyAreas={bodyAreas}
    />
  );
}
