"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import {
  DOCUMENT_MIME_TYPES,
  DOCUMENT_PREFIX,
  MAX_DOCUMENT_BYTES,
  deleteBlob,
  uploadBlob,
} from "@/lib/blob";
import { canExtractText, extractText } from "@/lib/text-extract";

const uploadSchema = z.object({
  kind: z.enum(schema.DOCUMENT_KINDS),
  title: z.string().min(1).max(200),
  jobApplicationId: z
    .preprocess((v) => {
      if (typeof v !== "string" || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }, z.number().int().nullable()),
});

export type UploadDocumentResult =
  | {
      ok: true;
      id: number;
      url: string;
      extractedChars: number;
    }
  | { ok: false; error: string };

export async function uploadDocument(
  formData: FormData,
): Promise<UploadDocumentResult> {
  const { isDemoMode, DEMO_BLOCKED_MESSAGE } = await import("@/lib/demo");
  if (isDemoMode()) return { ok: false, error: DEMO_BLOCKED_MESSAGE };
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Vælg en fil" };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `For stor (${Math.round(file.size / 1024 / 1024)} MB > 10 MB)`,
    };
  }
  if (!DOCUMENT_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `Ikke understøttet format: ${file.type}. Brug PDF, DOCX, HTML, MD eller TXT.`,
    };
  }

  const parsed = uploadSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    jobApplicationId: formData.get("jobApplicationId"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const extracted = canExtractText(file.type)
    ? await extractText(buf, file.type)
    : null;

  const uploaded = await uploadBlob({
    data: buf,
    prefix: `${DOCUMENT_PREFIX}/${user.id}`,
    filename: file.name,
    contentType: file.type,
  });

  const inserted = await db
    .insert(schema.documents)
    .values({
      userId: user.id,
      kind: parsed.data.kind,
      title: parsed.data.title.trim(),
      filename: file.name,
      blobUrl: uploaded.url,
      blobPathname: uploaded.pathname,
      mimeType: file.type,
      sizeBytes: uploaded.size,
      extractedText: extracted,
      jobApplicationId: parsed.data.jobApplicationId,
    })
    .returning();

  revalidatePath("/documents");
  if (parsed.data.jobApplicationId) revalidatePath("/jobs");
  return {
    ok: true,
    id: inserted[0].id,
    url: uploaded.url,
    extractedChars: extracted?.length ?? 0,
  };
}

export async function deleteDocument(id: number) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.documents)
    .where(
      and(eq(schema.documents.id, id), eq(schema.documents.userId, user.id)),
    )
    .limit(1);
  const doc = rows[0];
  if (!doc) return { ok: false as const, error: "Findes ikke" };

  await deleteBlob(doc.blobUrl);
  await db.delete(schema.documents).where(eq(schema.documents.id, id));
  revalidatePath("/documents");
  return { ok: true as const };
}

export async function listDocuments() {
  const user = await requireUser();
  return db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.userId, user.id))
    .orderBy(desc(schema.documents.createdAt));
}

export async function attachDocument(input: {
  documentId: number;
  jobApplicationId: number;
}) {
  const user = await requireUser();
  const docRows = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, input.documentId),
        eq(schema.documents.userId, user.id),
      ),
    )
    .limit(1);
  if (!docRows[0]) return { ok: false as const, error: "Dokument findes ikke" };

  const appRows = await db
    .select({ id: schema.jobApplications.id })
    .from(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.id, input.jobApplicationId),
        eq(schema.jobApplications.userId, user.id),
      ),
    )
    .limit(1);
  if (!appRows[0]) {
    return { ok: false as const, error: "Ansøgning findes ikke" };
  }

  await db
    .update(schema.documents)
    .set({ jobApplicationId: input.jobApplicationId })
    .where(eq(schema.documents.id, input.documentId));

  revalidatePath("/jobs");
  revalidatePath("/today");
  revalidatePath("/documents");
  return { ok: true as const };
}

export async function detachDocument(documentId: number) {
  const user = await requireUser();
  await db
    .update(schema.documents)
    .set({ jobApplicationId: null })
    .where(
      and(
        eq(schema.documents.id, documentId),
        eq(schema.documents.userId, user.id),
      ),
    );

  revalidatePath("/jobs");
  revalidatePath("/today");
  revalidatePath("/documents");
  return { ok: true as const };
}

export async function searchDocuments(query: string) {
  const user = await requireUser();
  if (!query.trim()) return [];
  const term = `%${query.trim()}%`;
  return db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.userId, user.id),
        or(
          like(schema.documents.title, term),
          like(schema.documents.filename, term),
          like(schema.documents.extractedText, term),
        ),
      ),
    )
    .orderBy(desc(schema.documents.createdAt));
}
