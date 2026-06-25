import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { revalidatePath } from "next/cache";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";
import {
  PHOTO_MIME_TYPES,
  PHOTO_PREFIX,
  uploadBlob,
} from "../../lib/blob";
import { compressServerImage } from "../../lib/image-compress-server";

// Hard limit på MCP-input: base64-strengen må højst være ~8 MB
// (= ca. 6 MB rå billede). Større billeder bør komprimeres i klienten
// eller resizes før de når MCP-pakken.
const MAX_BASE64_BYTES = 8 * 1024 * 1024;

export function registerPhotoTools(server: McpServer) {
  server.registerTool(
    "list_photos",
    {
      title: "List billeder",
      description:
        "Returnerer metadata om uploaded billeder (kropsdel, kategori, dato, URL, evt. note). AI kan ikke se selve billederne direkte, men kan returnere URL'er som brugeren kan åbne.",
      inputSchema: {
        category: z
          .enum(schema.PHOTO_CATEGORIES)
          .optional()
          .describe("Filtrér: skin_spot, body_progress, other."),
        bodyArea: z
          .string()
          .max(120)
          .optional()
          .describe("Filtrér på kropsdel (case-sensitive, fri tekst)."),
        limit: z.number().int().min(1).max(200).default(100),
      },
    },
    async ({ category, bodyArea, limit }) => {
      const user = await getActiveUser();
      const conditions = [eq(schema.photos.userId, user.id)];
      if (category) conditions.push(eq(schema.photos.category, category));
      if (bodyArea) conditions.push(eq(schema.photos.bodyArea, bodyArea));

      const rows = await db
        .select()
        .from(schema.photos)
        .where(and(...conditions))
        .orderBy(asc(schema.photos.bodyArea), desc(schema.photos.takenAt))
        .limit(limit);

      return jsonContent({
        count: rows.length,
        photos: rows.map((p) => ({
          id: p.id,
          category: p.category,
          bodyArea: p.bodyArea,
          caption: p.caption,
          takenAt: p.takenAt,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          blobUrl: p.blobUrl,
        })),
      });
    },
  );

  server.registerTool(
    "list_body_areas",
    {
      title: "List unikke kropsdele",
      description:
        "Returnerer alle distinkte kropsdele brugeren har uploaded billeder for (fx 'venstre underarm', 'højre kind').",
      inputSchema: {},
    },
    async () => {
      const user = await getActiveUser();
      const rows = await db
        .selectDistinct({ bodyArea: schema.photos.bodyArea })
        .from(schema.photos)
        .where(eq(schema.photos.userId, user.id));
      const areas = rows
        .map((r) => r.bodyArea)
        .filter((a): a is string => !!a && a.trim() !== "")
        .sort();
      return jsonContent({ count: areas.length, bodyAreas: areas });
    },
  );

  server.registerTool(
    "upload_photo",
    {
      title: "Upload billede",
      description:
        "Uploader et billede til brugerens foto-arkiv. Tilknyt det til en tracker (anbefalet — find ID via list_trackers) eller specificér body_area direkte. Serveren komprimerer altid til ~500 KB max-bredde 2048px (samme som manuel upload). Sender du flere billeder samme dag, kald værktøjet én gang per billede.",
      inputSchema: {
        imageBase64: z
          .string()
          .min(100)
          .describe(
            "Selve billed-dataen som base64-streng (uden 'data:' prefix). Max ca. 6 MB rå (8 MB base64). PNG/JPEG/WebP.",
          ),
        mimeType: z
          .enum(["image/jpeg", "image/png", "image/webp"])
          .describe("Original MIME-type på billedet."),
        takenAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Hvornår blev billedet taget (YYYY-MM-DD). Brug i dag hvis ukendt."),
        trackerId: z
          .number()
          .int()
          .optional()
          .describe(
            "ID på den tracker billedet hører til (find via list_trackers). Hvis sat overstyrer den category/bodyArea.",
          ),
        bodyArea: z
          .string()
          .max(120)
          .optional()
          .describe(
            "Fri-tekst kropsdel (fx 'venstre underarm'). Bruges hvis ingen tracker er specificeret.",
          ),
        category: z
          .enum(schema.PHOTO_CATEGORIES)
          .optional()
          .describe("Kategori — sættes automatisk ud fra tracker hvis ikke specificeret."),
        caption: z.string().max(500).optional(),
      },
    },
    async ({
      imageBase64,
      mimeType,
      takenAt,
      trackerId,
      bodyArea,
      category,
      caption,
    }) => {
      const user = await getActiveUser();

      if (!PHOTO_MIME_TYPES.includes(mimeType)) {
        return errorContent(`Format ikke understøttet: ${mimeType}`);
      }
      if (imageBase64.length > MAX_BASE64_BYTES) {
        return errorContent(
          `Billede er for stort (${Math.round(imageBase64.length / 1024 / 1024)} MB base64 > 8 MB). Resize eller komprimér først.`,
        );
      }

      let rawBuf: Buffer;
      try {
        rawBuf = Buffer.from(imageBase64, "base64");
      } catch {
        return errorContent("Kunne ikke decode base64-strengen.");
      }
      if (rawBuf.length === 0) {
        return errorContent("Tom billed-data efter base64-decode.");
      }

      let tracker: typeof schema.trackers.$inferSelect | null = null;
      if (trackerId !== undefined) {
        const rows = await db
          .select()
          .from(schema.trackers)
          .where(
            and(
              eq(schema.trackers.id, trackerId),
              eq(schema.trackers.userId, user.id),
            ),
          )
          .limit(1);
        tracker = rows[0] ?? null;
        if (!tracker) return errorContent(`Tracker #${trackerId} findes ikke.`);
      }

      let compressed;
      try {
        compressed = await compressServerImage(rawBuf);
      } catch (err) {
        return errorContent(
          `Komprimering fejlede: ${err instanceof Error ? err.message : "ukendt"}.`,
        );
      }

      const uploaded = await uploadBlob({
        data: compressed.buffer,
        prefix: `${PHOTO_PREFIX}/${user.id}`,
        filename: `ai-upload-${takenAt}.jpg`,
        contentType: "image/jpeg",
      });

      const resolvedCategory =
        category ??
        (tracker?.kind === "skin_spot" ? "skin_spot" : "other");
      const resolvedBodyArea =
        bodyArea?.trim() || tracker?.name || null;

      const inserted = await db
        .insert(schema.photos)
        .values({
          userId: user.id,
          trackerId: trackerId ?? null,
          category: resolvedCategory,
          bodyArea: resolvedBodyArea,
          caption: caption?.trim() || null,
          blobUrl: uploaded.url,
          blobPathname: uploaded.pathname,
          mimeType: "image/jpeg",
          sizeBytes: uploaded.size,
          takenAt,
        })
        .returning();

      revalidatePath("/health/trackere");
      if (trackerId) revalidatePath(`/health/trackere/${trackerId}`);
      revalidatePath("/health");
      revalidatePath("/today");

      return jsonContent({
        ok: true,
        photoId: inserted[0].id,
        trackerId: trackerId ?? null,
        bodyArea: resolvedBodyArea,
        category: resolvedCategory,
        originalBytes: rawBuf.length,
        compressedBytes: compressed.bytes,
        dimensions: { width: compressed.width, height: compressed.height },
        compressionAttempts: compressed.attempts,
      });
    },
  );
}
