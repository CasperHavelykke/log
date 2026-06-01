import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { jsonContent } from "../format";

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
}
