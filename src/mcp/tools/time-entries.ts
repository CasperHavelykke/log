import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
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

export function registerTimeEntryTools(server: McpServer) {
  server.registerTool(
    "log_time",
    {
      title: "Log tid på et projekt",
      description:
        "Opretter eller opdaterer en tidsregistrering for et projekt på en bestemt dato. Sæt hours=0 for at slette en eksisterende registrering.",
      inputSchema: {
        projectId: z.number().int(),
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("YYYY-MM-DD. Standard: i dag."),
        hours: z.number().min(0).max(24).describe("Timer som decimaltal, fx 2.5."),
        notes: z.string().max(10_000).nullable().optional(),
      },
    },
    async ({ projectId, date, hours, notes }) => {
      const user = await getActiveUser();
      const target = date ?? todayIso();
      const hoursX10 = Math.round(hours * 10);

      const projectExists = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(
          and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)),
        )
        .limit(1);
      if (!projectExists[0]) return errorContent("Projekt findes ikke.");

      const existing = await db
        .select()
        .from(schema.timeEntries)
        .where(
          and(
            eq(schema.timeEntries.userId, user.id),
            eq(schema.timeEntries.projectId, projectId),
            eq(schema.timeEntries.date, target),
          ),
        )
        .limit(1);

      if (hoursX10 === 0) {
        if (existing[0]) {
          await db
            .delete(schema.timeEntries)
            .where(eq(schema.timeEntries.id, existing[0].id));
        }
        return jsonContent({ date: target, projectId, action: "deleted" });
      }

      const now = new Date().toISOString();
      if (existing[0]) {
        await db
          .update(schema.timeEntries)
          .set({ hoursX10, notes: notes ?? null, updatedAt: now })
          .where(eq(schema.timeEntries.id, existing[0].id));
        return jsonContent({ date: target, projectId, action: "updated", hours });
      }
      await db.insert(schema.timeEntries).values({
        userId: user.id,
        projectId,
        date: target,
        hoursX10,
        notes: notes ?? null,
      });
      return jsonContent({ date: target, projectId, action: "created", hours });
    },
  );

  server.registerTool(
    "list_time_entries",
    {
      title: "List tidsregistreringer",
      description:
        "Returnerer registrerede timer i et datointerval, evt. filtreret på projekt.",
      inputSchema: {
        from: z.string().regex(dateRegex),
        to: z.string().regex(dateRegex),
        projectId: z.number().int().optional(),
      },
    },
    async ({ from, to, projectId }) => {
      if (from > to) return errorContent("Startdato er efter slutdato.");
      const user = await getActiveUser();
      const conditions = [
        eq(schema.timeEntries.userId, user.id),
        gte(schema.timeEntries.date, from),
        lte(schema.timeEntries.date, to),
      ];
      if (projectId !== undefined) {
        conditions.push(eq(schema.timeEntries.projectId, projectId));
      }
      const rows = await db
        .select({
          id: schema.timeEntries.id,
          date: schema.timeEntries.date,
          projectId: schema.timeEntries.projectId,
          projectName: schema.projects.name,
          hours: schema.timeEntries.hoursX10,
          notes: schema.timeEntries.notes,
        })
        .from(schema.timeEntries)
        .innerJoin(
          schema.projects,
          eq(schema.projects.id, schema.timeEntries.projectId),
        )
        .where(and(...conditions))
        .orderBy(desc(schema.timeEntries.date), asc(schema.projects.name));

      return jsonContent({
        from,
        to,
        entries: rows.map((r) => ({
          id: r.id,
          date: r.date,
          projectId: r.projectId,
          projectName: r.projectName,
          hours: r.hours / 10,
          notes: r.notes,
        })),
      });
    },
  );

  server.registerTool(
    "time_summary",
    {
      title: "Tidsoversigt pr. projekt",
      description: "Aggregerer timer pr. projekt i et datointerval.",
      inputSchema: {
        from: z.string().regex(dateRegex),
        to: z.string().regex(dateRegex),
      },
    },
    async ({ from, to }) => {
      if (from > to) return errorContent("Startdato er efter slutdato.");
      const user = await getActiveUser();
      const rows = await db
        .select({
          projectId: schema.timeEntries.projectId,
          projectName: schema.projects.name,
          totalHoursX10: sql<number>`SUM(${schema.timeEntries.hoursX10})`,
          dayCount: sql<number>`COUNT(*)`,
        })
        .from(schema.timeEntries)
        .innerJoin(
          schema.projects,
          eq(schema.projects.id, schema.timeEntries.projectId),
        )
        .where(
          and(
            eq(schema.timeEntries.userId, user.id),
            gte(schema.timeEntries.date, from),
            lte(schema.timeEntries.date, to),
          ),
        )
        .groupBy(schema.timeEntries.projectId, schema.projects.name)
        .orderBy(desc(sql`SUM(${schema.timeEntries.hoursX10})`));

      return jsonContent({
        from,
        to,
        projects: rows.map((r) => ({
          projectId: r.projectId,
          projectName: r.projectName,
          totalHours: Number(r.totalHoursX10) / 10,
          dayCount: Number(r.dayCount),
        })),
      });
    },
  );
}
