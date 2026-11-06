"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import {
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
  deleteBlob,
  uploadBlob,
} from "@/lib/blob";

const PROFILE_PREFIX = "profile";

export async function uploadProfileImage(formData: FormData) {
  const { isDemoMode, DEMO_BLOCKED_MESSAGE } = await import("@/lib/demo");
  if (isDemoMode()) return { ok: false as const, error: DEMO_BLOCKED_MESSAGE };
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Vælg en fil" };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false as const, error: "For stor — maks 5 MB" };
  }
  if (!PHOTO_MIME_TYPES.includes(file.type)) {
    return { ok: false as const, error: "Brug JPG, PNG eller WebP" };
  }

  // Skalér ned og gem altid som JPEG. Et mobilfoto på 4 MB bliver ca. 50 KB.
  const original = Buffer.from(await file.arrayBuffer());
  let resized: Buffer;
  try {
    resized = await sharp(original)
      .rotate()
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return { ok: false as const, error: "Kunne ikke læse billedet" };
  }

  const uploaded = await uploadBlob({
    data: resized,
    prefix: `${PROFILE_PREFIX}/${user.id}`,
    filename: "profil.jpg",
    contentType: "image/jpeg",
  });

  // Ét billede pr. bruger: ryd det gamle op.
  if (user.profileImagePathname) {
    await deleteBlob(user.profileImagePathname);
  }

  await db
    .update(schema.users)
    .set({ profileImagePathname: uploaded.pathname })
    .where(eq(schema.users.id, user.id));

  revalidatePath("/settings");
  return { ok: true as const };
}

export async function removeProfileImage() {
  const { isDemoMode, DEMO_BLOCKED_MESSAGE } = await import("@/lib/demo");
  if (isDemoMode()) return { ok: false as const, error: DEMO_BLOCKED_MESSAGE };
  const user = await requireUser();

  // Slet filen fra disken.
  if (user.profileImagePathname) {
    await deleteBlob(user.profileImagePathname);
  }

  await db
    .update(schema.users)
    .set({ profileImagePathname: null })
    .where(eq(schema.users.id, user.id));

  revalidatePath("/settings");
  return { ok: true as const };
}