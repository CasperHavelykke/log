import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

export function registerTrackerTools(server: McpServer) {
  server.registerTool(
    "list_trackers",
    {
      title: "List trackere",
      description:
        "Returnerer alle trackere (skønhedspletter, hud-områder, vægt, livvidde, etc.) brugeren følger over tid med billeder. Trackere koblet til daglige målinger (weight, waist, dermatitis, staph) har også numerisk data tilgængelig via day_entries.",
      inputSchema: {
        kind: z
          .enum(schema.TRACKER_KINDS)
          .optional()
          .describe("Filtrér: skin_spot, dermatitis, staph, weight, waist, other"),
        includeArchived: z.boolean().default(false),
      },
    },
    async ({ kind, includeArchived }) => {
      const user = await getActiveUser();
      const conditions = [eq(schema.trackers.userId, user.id)];
      if (!includeArchived) {
        conditions.push(eq(schema.trackers.archived, false));
      }
      if (kind) conditions.push(eq(schema.trackers.kind, kind));

      const rows = await db
        .select()
        .from(schema.trackers)
        .where(and(...conditions))
        .orderBy(asc(schema.trackers.name));

      return jsonContent({
        count: rows.length,
        trackers: rows.map((t) => ({
          id: t.id,
          name: t.name,
          kind: t.kind,
          notes: t.notes,
          archived: t.archived,
          createdAt: t.createdAt,
        })),
      });
    },
  );

  server.registerTool(
    "get_tracker",
    {
      title: "Hent tracker med billeder",
      description:
        "Returnerer en tracker inkl. alle billeder (URL'er + datoer + noter). For trackere af typen weight/waist/dermatitis/staph returneres også den numeriske historik fra day_entries.",
      inputSchema: {
        id: z.number().int(),
      },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const tRows = await db
        .select()
        .from(schema.trackers)
        .where(
          and(
            eq(schema.trackers.id, id),
            eq(schema.trackers.userId, user.id),
          ),
        )
        .limit(1);
      const tracker = tRows[0];
      if (!tracker) return errorContent("Tracker findes ikke");

      const photos = await db
        .select({
          id: schema.photos.id,
          takenAt: schema.photos.takenAt,
          caption: schema.photos.caption,
          blobUrl: schema.photos.blobUrl,
          mimeType: schema.photos.mimeType,
        })
        .from(schema.photos)
        .where(
          and(
            eq(schema.photos.trackerId, id),
            eq(schema.photos.userId, user.id),
          ),
        )
        .orderBy(desc(schema.photos.takenAt));

      let metricSeries:
        | { date: string; value: number; unit: string }[]
        | null = null;

      if (
        tracker.kind === "weight" ||
        tracker.kind === "waist" ||
        tracker.kind === "dermatitis" ||
        tracker.kind === "staph"
      ) {
        const allDays = await db
          .select()
          .from(schema.dayEntries)
          .where(eq(schema.dayEntries.userId, user.id))
          .orderBy(asc(schema.dayEntries.date));

        const series: { date: string; value: number; unit: string }[] = [];
        for (const d of allDays) {
          if (tracker.kind === "weight" && d.weightX10 !== null) {
            series.push({ date: d.date, value: d.weightX10 / 10, unit: "kg" });
          } else if (tracker.kind === "waist" && d.waistX10 !== null) {
            series.push({ date: d.date, value: d.waistX10 / 10, unit: "cm" });
          } else if (
            tracker.kind === "dermatitis" &&
            d.seborrheicDermatitis !== null
          ) {
            series.push({
              date: d.date,
              value: d.seborrheicDermatitis,
              unit: "/5",
            });
          } else if (tracker.kind === "staph" && d.staph !== null) {
            series.push({ date: d.date, value: d.staph, unit: "/5" });
          }
        }
        metricSeries = series;
      }

      return jsonContent({
        tracker: {
          id: tracker.id,
          name: tracker.name,
          kind: tracker.kind,
          notes: tracker.notes,
          archived: tracker.archived,
          createdAt: tracker.createdAt,
        },
        photos: photos.map((p) => ({
          id: p.id,
          takenAt: p.takenAt,
          caption: p.caption,
          mimeType: p.mimeType,
          blobUrl: p.blobUrl,
        })),
        metricSeries,
      });
    },
  );
}
