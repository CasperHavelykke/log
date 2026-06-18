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

const createSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(schema.TRACKER_KINDS),
  notes: z.string().max(2000).nullable().optional(),
});

export async function createTracker(input: z.infer<typeof createSchema>) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const inserted = await db
    .insert(schema.trackers)
    .values({
      userId: user.id,
      name: parsed.data.name.trim(),
      kind: parsed.data.kind,
      notes: parsed.data.notes?.trim() || null,
    })
    .returning();
  revalidatePath("/health/trackere");
  return { ok: true as const, tracker: inserted[0] };
}

const updateSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(120).optional(),
  kind: z.enum(schema.TRACKER_KINDS).optional(),
  notes: z.string().max(2000).nullable().optional(),
  archived: z.boolean().optional(),
});

export async function updateTracker(input: z.infer<typeof updateSchema>) {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const { id, ...changes } = parsed.data;
  const fields: Record<string, unknown> = {};
  if (changes.name !== undefined) fields.name = changes.name.trim();
  if (changes.kind !== undefined) fields.kind = changes.kind;
  if (changes.notes !== undefined) fields.notes = changes.notes?.trim() || null;
  if (changes.archived !== undefined) fields.archived = changes.archived;

  if (Object.keys(fields).length === 0) return { ok: true as const };

  await db
    .update(schema.trackers)
    .set(fields)
    .where(
      and(eq(schema.trackers.id, id), eq(schema.trackers.userId, user.id)),
    );
  revalidatePath("/health/trackere");
  revalidatePath(`/health/trackere/${id}`);
  return { ok: true as const };
}

export async function deleteTracker(id: number) {
  const user = await requireUser();
  const photos = await db
    .select({ id: schema.photos.id, blobUrl: schema.photos.blobUrl })
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.trackerId, id),
        eq(schema.photos.userId, user.id),
      ),
    );
  for (const p of photos) {
    await deleteBlob(p.blobUrl);
  }
  await db.delete(schema.photos).where(
    and(
      eq(schema.photos.trackerId, id),
      eq(schema.photos.userId, user.id),
    ),
  );
  await db
    .delete(schema.trackers)
    .where(
      and(eq(schema.trackers.id, id), eq(schema.trackers.userId, user.id)),
    );
  revalidatePath("/health/trackere");
  return { ok: true as const };
}

export async function listTrackers(includeArchived = false) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.trackers)
    .where(
      includeArchived
        ? eq(schema.trackers.userId, user.id)
        : and(
            eq(schema.trackers.userId, user.id),
            eq(schema.trackers.archived, false),
          ),
    )
    .orderBy(asc(schema.trackers.name));
  return rows;
}

export async function getTracker(id: number) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.trackers)
    .where(
      and(eq(schema.trackers.id, id), eq(schema.trackers.userId, user.id)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listTrackerPhotos(trackerId: number) {
  const user = await requireUser();
  return db
    .select()
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.trackerId, trackerId),
        eq(schema.photos.userId, user.id),
      ),
    )
    .orderBy(desc(schema.photos.takenAt));
}

const uploadSchema = z.object({
  trackerId: z.coerce.number().int(),
  caption: z.string().max(500).nullable(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function uploadTrackerPhoto(formData: FormData) {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Vælg en fil" };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false as const,
      error: `For stor (${Math.round(file.size / 1024 / 1024)} MB > 5 MB)`,
    };
  }
  if (!PHOTO_MIME_TYPES.includes(file.type)) {
    return {
      ok: false as const,
      error: `Ikke understøttet format: ${file.type}`,
    };
  }

  const parsed = uploadSchema.safeParse({
    trackerId: formData.get("trackerId"),
    caption: (formData.get("caption") as string | null) || null,
    takenAt: formData.get("takenAt"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }

  const tracker = await getTracker(parsed.data.trackerId);
  if (!tracker) return { ok: false as const, error: "Tracker findes ikke" };

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
      trackerId: parsed.data.trackerId,
      category: tracker.kind === "skin_spot" ? "skin_spot" : "other",
      bodyArea: tracker.name,
      caption: parsed.data.caption?.trim() || null,
      blobUrl: uploaded.url,
      blobPathname: uploaded.pathname,
      mimeType: file.type,
      sizeBytes: uploaded.size,
      takenAt: parsed.data.takenAt,
    })
    .returning();

  revalidatePath("/health/trackere");
  revalidatePath(`/health/trackere/${parsed.data.trackerId}`);
  revalidatePath("/today");
  revalidatePath("/health");
  return {
    ok: true as const,
    id: inserted[0].id,
    url: uploaded.url,
  };
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
  revalidatePath("/health/trackere");
  if (photo.trackerId) {
    revalidatePath(`/health/trackere/${photo.trackerId}`);
  }
  return { ok: true as const };
}
