"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import {
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
  PHOTO_PREFIX,
  deleteBlob,
  uploadBlob,
} from "@/lib/blob";

const uploadSchema = z.object({
  category: z.enum(schema.PHOTO_CATEGORIES),
  bodyArea: z.string().max(120).nullable(),
  caption: z.string().max(500).nullable(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type UploadPhotoResult =
  | { ok: true; id: number; url: string }
  | { ok: false; error: string };

export async function uploadPhoto(
  formData: FormData,
): Promise<UploadPhotoResult> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Vælg en fil" };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `For stor (${Math.round(file.size / 1024 / 1024)} MB > 5 MB)`,
    };
  }
  if (!PHOTO_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `Ikke understøttet format: ${file.type}. Brug JPEG, PNG eller WebP.`,
    };
  }

  const parsed = uploadSchema.safeParse({
    category: formData.get("category"),
    bodyArea: (formData.get("bodyArea") as string | null) || null,
    caption: (formData.get("caption") as string | null) || null,
    takenAt: formData.get("takenAt"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadBlob({
    data: buf,
    prefix: `${PHOTO_PREFIX}/${user.id}`,
    filename: file.name,
    contentType: file.type,
  });

  const inserted = await db
    .insert(schema.photos)
    .values({
      userId: user.id,
      category: parsed.data.category,
      bodyArea: parsed.data.bodyArea?.trim() || null,
      caption: parsed.data.caption?.trim() || null,
      blobUrl: uploaded.url,
      blobPathname: uploaded.pathname,
      mimeType: file.type,
      sizeBytes: uploaded.size,
      takenAt: parsed.data.takenAt,
    })
    .returning();

  revalidatePath("/health/photos");
  return { ok: true, id: inserted[0].id, url: uploaded.url };
}

export async function deletePhoto(id: number) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.photos)
    .where(
      and(eq(schema.photos.id, id), eq(schema.photos.userId, user.id)),
    )
    .limit(1);
  const photo = rows[0];
  if (!photo) return { ok: false as const, error: "Findes ikke" };

  await deleteBlob(photo.blobUrl);
  await db.delete(schema.photos).where(eq(schema.photos.id, id));
  revalidatePath("/health/photos");
  return { ok: true as const };
}

export async function listBodyAreas(): Promise<string[]> {
  const user = await requireUser();
  const rows = await db
    .selectDistinct({ bodyArea: schema.photos.bodyArea })
    .from(schema.photos)
    .where(eq(schema.photos.userId, user.id));
  return rows
    .map((r) => r.bodyArea)
    .filter((b): b is string => !!b && b.trim() !== "")
    .sort();
}

export async function listPhotos() {
  const user = await requireUser();
  return db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.userId, user.id))
    .orderBy(asc(schema.photos.bodyArea), desc(schema.photos.takenAt));
}

export async function setPhotoTracker(photoId: number, trackerId: number | null) {
  const user = await requireUser();
  await db
    .update(schema.photos)
    .set({ trackerId })
    .where(
      and(eq(schema.photos.id, photoId), eq(schema.photos.userId, user.id)),
    );
  revalidatePath("/health/photos");
  revalidatePath("/health/trackere");
  return { ok: true as const };
}

export async function updatePhotoCaption(photoId: number, caption: string) {
  const user = await requireUser();
  await db
    .update(schema.photos)
    .set({ caption: caption.trim() || null })
    .where(
      and(eq(schema.photos.id, photoId), eq(schema.photos.userId, user.id)),
    );
  revalidatePath("/health/photos");
  return { ok: true as const };
}
