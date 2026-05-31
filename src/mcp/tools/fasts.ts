import { and, between, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { FAST_QUALIFIED_MINUTES } from "../../db/schema";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function durationMin(startedAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 60_000));
}

function shape(row: typeof schema.fasts.$inferSelect) {
  const mins = durationMin(row.startedAt, row.endedAt);
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    isActive: row.endedAt === null,
    durationMinutes: mins,
    durationHours: Math.round((mins / 60) * 100) / 100,
    qualified: row.endedAt !== null && mins >= FAST_QUALIFIED_MINUTES,
    note: row.note,
  };
}

export function registerFastTools(server: McpServer) {
  server.registerTool(
    "get_active_fast",
    {
      title: "Hent aktiv faste (hvis nogen)",
      description:
        "Returnerer brugerens igangværende faste — eller null hvis ingen er aktiv. En faste er kvalificeret når den varer ≥16 timer.",
      inputSchema: {},
    },
    async () => {
      const user = await getActiveUser();
      const rows = await db
        .select()
        .from(schema.fasts)
        .where(
          and(eq(schema.fasts.userId, user.id), isNull(schema.fasts.endedAt)),
        )
        .limit(1);
      return jsonContent(rows[0] ? shape(rows[0]) : null);
    },
  );

  server.registerTool(
    "start_fast",
    {
      title: "Start en faste",
      description:
        "Registrerer at brugeren stopper med at spise. startedAt er valgfri — undlades den bruges nu. Brug startedAt til at bagdatere ('jeg stoppede med at spise i går kl. 21'). Returnerer eksisterende aktive faste hvis der allerede er én.",
      inputSchema: {
        startedAt: z
          .string()
          .datetime()
          .optional()
          .describe(
            "ISO-tidsstempel som '2026-05-25T21:00:00Z'. Standard: nu.",
          ),
        note: z.string().max(2_000).nullable().optional(),
      },
    },
    async ({ startedAt, note }) => {
      const user = await getActiveUser();
      const open = await db
        .select()
        .from(schema.fasts)
        .where(
          and(eq(schema.fasts.userId, user.id), isNull(schema.fasts.endedAt)),
        )
        .limit(1);
      if (open[0]) {
        return jsonContent({ ...shape(open[0]), wasAlreadyActive: true });
      }
      const start = startedAt ?? new Date().toISOString();
      if (new Date(start).getTime() > Date.now()) {
        return errorContent("Start-tidspunkt kan ikke ligge i fremtiden.");
      }
      const inserted = await db
        .insert(schema.fasts)
        .values({ userId: user.id, startedAt: start, note: note ?? null })
        .returning();
      return jsonContent({ ...shape(inserted[0]), wasAlreadyActive: false });
    },
  );

  server.registerTool(
    "end_fast",
    {
      title: "Bryd den aktive faste",
      description:
        "Markerer den aktive faste som afsluttet. endedAt er valgfri — undlades den bruges nu. Brug til at logge retroaktivt ('jeg brød fasten kl. 13 i dag').",
      inputSchema: {
        endedAt: z
          .string()
          .datetime()
          .optional()
          .describe("ISO-tidsstempel. Standard: nu."),
        note: z.string().max(2_000).nullable().optional(),
      },
    },
    async ({ endedAt, note }) => {
      const user = await getActiveUser();
      const open = await db
        .select()
        .from(schema.fasts)
        .where(
          and(eq(schema.fasts.userId, user.id), isNull(schema.fasts.endedAt)),
        )
        .limit(1);
      if (!open[0]) {
        return errorContent("Ingen aktiv faste at bryde.");
      }
      const end = endedAt ?? new Date().toISOString();
      if (new Date(end) < new Date(open[0].startedAt)) {
        return errorContent(
          `Slut-tidspunkt (${end}) ligger før start-tidspunkt (${open[0].startedAt}).`,
        );
      }
      const updated = await db
        .update(schema.fasts)
        .set({
          endedAt: end,
          note: note !== undefined ? note : open[0].note,
        })
        .where(eq(schema.fasts.id, open[0].id))
        .returning();
      return jsonContent(shape(updated[0]));
    },
  );

  server.registerTool(
    "update_fast",
    {
      title: "Redigér en faste",
      description:
        "Opdaterer start-tid, slut-tid eller note på en eksisterende faste. Brug fx til at rette et tidspunkt: 'jeg glemte at klikke knappen, jeg stoppede faktisk kl. 20:30 i går'. Felter der ikke angives bevares. Send endedAt: null for at gøre en afsluttet faste aktiv igen.",
      inputSchema: {
        id: z.number().int(),
        startedAt: z.string().datetime().optional(),
        endedAt: z.string().datetime().nullable().optional(),
        note: z.string().max(2_000).nullable().optional(),
      },
    },
    async ({ id, startedAt, endedAt, note }) => {
      const user = await getActiveUser();
      const existing = await db
        .select()
        .from(schema.fasts)
        .where(and(eq(schema.fasts.id, id), eq(schema.fasts.userId, user.id)))
        .limit(1);
      if (!existing[0]) return errorContent("Faste findes ikke.");

      const fields: Record<string, unknown> = {};
      if (startedAt !== undefined) fields.startedAt = startedAt;
      if (endedAt !== undefined) fields.endedAt = endedAt;
      if (note !== undefined) fields.note = note;
      if (Object.keys(fields).length === 0) {
        return jsonContent(shape(existing[0]));
      }

      // Konsistens-tjek
      const resolvedStart = startedAt ?? existing[0].startedAt;
      const resolvedEnd =
        endedAt === undefined ? existing[0].endedAt : endedAt;
      if (
        resolvedEnd !== null &&
        new Date(resolvedEnd) < new Date(resolvedStart)
      ) {
        return errorContent(
          "Slut-tidspunkt kan ikke ligge før start-tidspunkt.",
        );
      }
      if (new Date(resolvedStart).getTime() > Date.now()) {
        return errorContent("Start-tidspunkt kan ikke ligge i fremtiden.");
      }

      const updated = await db
        .update(schema.fasts)
        .set(fields)
        .where(eq(schema.fasts.id, id))
        .returning();
      return jsonContent(shape(updated[0]));
    },
  );

  server.registerTool(
    "delete_fast",
    {
      title: "Slet en faste",
      description: "Sletter en faste-registrering permanent.",
      inputSchema: { id: z.number().int() },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const deleted = await db
        .delete(schema.fasts)
        .where(and(eq(schema.fasts.id, id), eq(schema.fasts.userId, user.id)))
        .returning();
      if (!deleted[0]) return errorContent("Faste findes ikke.");
      return jsonContent({ deleted: deleted[0].id });
    },
  );

  server.registerTool(
    "list_fasts",
    {
      title: "List faster i interval",
      description:
        "Returnerer alle faster der startede mellem to datoer (inklusive).",
      inputSchema: {
        from: z.string().regex(dateRegex),
        to: z.string().regex(dateRegex),
      },
    },
    async ({ from, to }) => {
      if (from > to) return errorContent("Startdato er efter slutdato.");
      const user = await getActiveUser();
      const fromIso = `${from}T00:00:00.000Z`;
      const toIso = `${to}T23:59:59.999Z`;
      const rows = await db
        .select()
        .from(schema.fasts)
        .where(
          and(
            eq(schema.fasts.userId, user.id),
            between(schema.fasts.startedAt, fromIso, toIso),
          ),
        )
        .orderBy(desc(schema.fasts.startedAt));
      return jsonContent({ from, to, fasts: rows.map(shape) });
    },
  );

  server.registerTool(
    "fast_summary",
    {
      title: "Faste-oversigt for sidste N dage",
      description:
        "Aggregerer antal kvalificerede faster (≥16t), total faste-tid, gennemsnitsvarighed og længste faste i de sidste N dage.",
      inputSchema: {
        days: z.number().int().min(1).max(365).default(30),
      },
    },
    async ({ days }) => {
      const user = await getActiveUser();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();

      const rows = await db
        .select()
        .from(schema.fasts)
        .where(
          and(
            eq(schema.fasts.userId, user.id),
            // We want fasts that ended in the period; filter in JS for simplicity.
          ),
        );

      const completed = rows.filter(
        (r) => r.endedAt !== null && r.endedAt >= startIso,
      );
      const durations = completed.map((r) => durationMin(r.startedAt, r.endedAt));
      const qualified = durations.filter((m) => m >= FAST_QUALIFIED_MINUTES);
      const totalMin = durations.reduce((a, b) => a + b, 0);
      const avgMin =
        durations.length === 0
          ? 0
          : Math.round(totalMin / durations.length);
      const longestMin = durations.length === 0 ? 0 : Math.max(...durations);

      return jsonContent({
        rangeDays: days,
        from: startIso.slice(0, 10),
        totalFasts: completed.length,
        qualifiedFasts: qualified.length,
        totalHours: Math.round((totalMin / 60) * 10) / 10,
        avgHours: Math.round((avgMin / 60) * 10) / 10,
        longestHours: Math.round((longestMin / 60) * 10) / 10,
      });
    },
  );
}
