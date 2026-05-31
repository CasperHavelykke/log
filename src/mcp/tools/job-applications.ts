import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const statusEnum = z.enum(schema.JOB_STATUSES);

function shape(row: typeof schema.jobApplications.$inferSelect) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    files: row.files,
    url: row.url,
    contactPerson: row.contactPerson,
    notes: row.notes,
    applicationText: row.applicationText,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function registerJobApplicationTools(server: McpServer) {
  server.registerTool(
    "list_job_applications",
    {
      title: "List ansøgninger",
      description:
        "Returnerer ansøgninger, evt. filtreret på status og/eller datointerval (på sentAt).",
      inputSchema: {
        status: statusEnum.optional(),
        from: z.string().regex(dateRegex).optional(),
        to: z.string().regex(dateRegex).optional(),
      },
    },
    async ({ status, from, to }) => {
      const user = await getActiveUser();
      const conditions = [eq(schema.jobApplications.userId, user.id)];
      if (status) conditions.push(eq(schema.jobApplications.status, status));
      if (from) conditions.push(gte(schema.jobApplications.sentAt, from));
      if (to) conditions.push(lte(schema.jobApplications.sentAt, to));

      const rows = await db
        .select()
        .from(schema.jobApplications)
        .where(and(...conditions))
        .orderBy(desc(schema.jobApplications.sentAt), asc(schema.jobApplications.id));
      return jsonContent(rows.map(shape));
    },
  );

  server.registerTool(
    "create_job_application",
    {
      title: "Opret ansøgning",
      description: "Registrerer en ny ansøgning.",
      inputSchema: {
        company: z.string().min(1).max(200),
        role: z.string().max(200).nullable().optional(),
        status: statusEnum.default("sent"),
        sentAt: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("Standard: i dag."),
        files: z.string().max(2_000).nullable().optional(),
        url: z.string().max(500).nullable().optional(),
        contactPerson: z.string().max(200).nullable().optional(),
        notes: z.string().max(10_000).nullable().optional(),
        applicationText: z
          .string()
          .max(100_000)
          .nullable()
          .optional()
          .describe(
            "Selve ansøgningens tekstindhold (cover letter). Bruges af 'search_application_texts' til at finde inspiration.",
          ),
      },
    },
    async (args) => {
      const user = await getActiveUser();
      const sentAt = args.sentAt ?? todayIso();
      const inserted = await db
        .insert(schema.jobApplications)
        .values({
          userId: user.id,
          company: args.company.trim(),
          role: args.role ?? null,
          status: args.status,
          sentAt,
          files: args.files ?? null,
          url: args.url ?? null,
          contactPerson: args.contactPerson ?? null,
          notes: args.notes ?? null,
          applicationText: args.applicationText ?? null,
        })
        .returning();
      await db.insert(schema.applicationEvents).values({
        userId: user.id,
        applicationId: inserted[0].id,
        status: args.status,
        occurredAt: sentAt,
      });
      return jsonContent(shape(inserted[0]));
    },
  );

  server.registerTool(
    "update_job_application",
    {
      title: "Opdater ansøgning",
      description:
        "Opdaterer felter på en eksisterende ansøgning. Felter der ikke angives forbliver uændret.",
      inputSchema: {
        id: z.number().int(),
        status: statusEnum.optional(),
        company: z.string().min(1).max(200).optional(),
        role: z.string().max(200).nullable().optional(),
        files: z.string().max(2_000).nullable().optional(),
        url: z.string().max(500).nullable().optional(),
        contactPerson: z.string().max(200).nullable().optional(),
        notes: z.string().max(10_000).nullable().optional(),
        applicationText: z.string().max(100_000).nullable().optional(),
      },
    },
    async ({ id, ...changes }) => {
      const user = await getActiveUser();
      const existing = await db
        .select()
        .from(schema.jobApplications)
        .where(
          and(
            eq(schema.jobApplications.id, id),
            eq(schema.jobApplications.userId, user.id),
          ),
        )
        .limit(1);
      if (!existing[0]) return errorContent("Ansøgning findes ikke.");

      const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const [k, v] of Object.entries(changes)) {
        if (v !== undefined) set[k] = v;
      }

      const updated = await db
        .update(schema.jobApplications)
        .set(set)
        .where(eq(schema.jobApplications.id, id))
        .returning();

      if (changes.status !== undefined && changes.status !== existing[0].status) {
        await db.insert(schema.applicationEvents).values({
          userId: user.id,
          applicationId: id,
          status: changes.status,
          occurredAt: todayIso(),
        });
      }

      return jsonContent(shape(updated[0]));
    },
  );

  server.registerTool(
    "get_application_timeline",
    {
      title: "Hent en ansøgnings statushistorik",
      description:
        "Returnerer alle statusændringer for en ansøgning i kronologisk rækkefølge.",
      inputSchema: { id: z.number().int() },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const app = await db
        .select()
        .from(schema.jobApplications)
        .where(
          and(
            eq(schema.jobApplications.id, id),
            eq(schema.jobApplications.userId, user.id),
          ),
        )
        .limit(1);
      if (!app[0]) return errorContent("Ansøgning findes ikke.");

      const events = await db
        .select()
        .from(schema.applicationEvents)
        .where(eq(schema.applicationEvents.applicationId, id))
        .orderBy(
          asc(schema.applicationEvents.occurredAt),
          asc(schema.applicationEvents.id),
        );
      return jsonContent({
        application: { id: app[0].id, company: app[0].company, role: app[0].role },
        timeline: events.map((e) => ({
          status: e.status,
          occurredAt: e.occurredAt,
          note: e.note,
        })),
      });
    },
  );

  server.registerTool(
    "delete_job_application",
    {
      title: "Slet ansøgning",
      description: "Sletter en ansøgning. Kan ikke fortrydes.",
      inputSchema: { id: z.number().int() },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const result = await db
        .delete(schema.jobApplications)
        .where(
          and(
            eq(schema.jobApplications.id, id),
            eq(schema.jobApplications.userId, user.id),
          ),
        )
        .returning();
      if (!result[0]) return errorContent("Ansøgning findes ikke.");
      return jsonContent({ deleted: result[0].id });
    },
  );

  server.registerTool(
    "search_application_texts",
    {
      title: "Søg i ansøgningernes tekstindhold",
      description:
        "Finder ansøgninger hvor applicationText indeholder den søgte tekst (case-insensitive). Returnerer matchende ansøgninger med deres tekst — bruges fx til at finde inspiration: 'find ansøgninger hvor jeg har skrevet om TypeScript' eller 'vis mig tidligere intro-afsnit'.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe(
            "Tekstuddrag der søges efter. Case-insensitive substring-søgning.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maks antal resultater. Standard: 10."),
      },
    },
    async ({ query, limit }) => {
      const user = await getActiveUser();
      const rows = await db
        .select()
        .from(schema.jobApplications)
        .where(eq(schema.jobApplications.userId, user.id));
      const needle = query.toLowerCase();
      const matches = rows
        .filter(
          (r) =>
            r.applicationText !== null &&
            r.applicationText.toLowerCase().includes(needle),
        )
        .slice(0, limit)
        .map(shape);
      return jsonContent({ query, count: matches.length, results: matches });
    },
  );
}
