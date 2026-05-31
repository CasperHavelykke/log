import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { jsonContent } from "../format";

function mondayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function shapeRow(row: typeof schema.weekGoals.$inferSelect | undefined) {
  if (!row) return null;
  return {
    text: row.text,
    applicationsTarget: row.applicationsTarget,
    focusHoursTarget:
      row.focusHoursTargetX10 === null ? null : row.focusHoursTargetX10 / 10,
    updatedAt: row.updatedAt,
  };
}

export function registerWeekGoalTools(server: McpServer) {
  server.registerTool(
    "get_week_goal",
    {
      title: "Hent ugemål",
      description:
        "Henter ugens mål (fri tekst + målsætning for antal ansøgninger og fokus-timer). Bruges fx til at sammenligne fremgang mod mål.",
      inputSchema: {
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("Vilkårlig dato i ugen (YYYY-MM-DD). Standard: i dag."),
      },
    },
    async ({ date }) => {
      const user = await getActiveUser();
      const weekStart = mondayOf(date ?? todayIso());
      const rows = await db
        .select()
        .from(schema.weekGoals)
        .where(
          and(
            eq(schema.weekGoals.userId, user.id),
            eq(schema.weekGoals.weekStart, weekStart),
          ),
        )
        .limit(1);
      return jsonContent({ weekStart, goal: shapeRow(rows[0]) });
    },
  );

  server.registerTool(
    "set_week_goal",
    {
      title: "Sæt eller opdater ugemål",
      description:
        "Skriver/opdaterer ugens mål. Felter du ikke angiver, bevares. Send tom streng eller null for at rydde et felt. Hvis alle tre felter er tomme, slettes målet.",
      inputSchema: {
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("Vilkårlig dato i ugen. Standard: i dag."),
        text: z
          .string()
          .max(2_000)
          .optional()
          .describe("Fri tekst om ugens mål. Tom streng rydder."),
        applicationsTarget: z
          .number()
          .int()
          .min(0)
          .max(1000)
          .nullable()
          .optional()
          .describe("Antal ansøgninger som mål. null rydder."),
        focusHoursTarget: z
          .number()
          .min(0)
          .max(240)
          .nullable()
          .optional()
          .describe("Antal fokus-timer som mål (decimal). null rydder."),
      },
    },
    async ({ date, text, applicationsTarget, focusHoursTarget }) => {
      const user = await getActiveUser();
      const weekStart = mondayOf(date ?? todayIso());
      const existing = await db
        .select()
        .from(schema.weekGoals)
        .where(
          and(
            eq(schema.weekGoals.userId, user.id),
            eq(schema.weekGoals.weekStart, weekStart),
          ),
        )
        .limit(1);
      const cur = existing[0];

      const nextText = text === undefined ? (cur?.text ?? "") : text;
      const nextApps =
        applicationsTarget === undefined
          ? (cur?.applicationsTarget ?? null)
          : applicationsTarget;
      const nextHoursX10 =
        focusHoursTarget === undefined
          ? (cur?.focusHoursTargetX10 ?? null)
          : focusHoursTarget === null
            ? null
            : Math.round(focusHoursTarget * 10);

      const allEmpty =
        nextText.trim() === "" && nextApps === null && nextHoursX10 === null;
      const now = new Date().toISOString();

      if (allEmpty) {
        if (cur) {
          await db
            .delete(schema.weekGoals)
            .where(eq(schema.weekGoals.id, cur.id));
        }
        return jsonContent({ weekStart, action: "deleted", goal: null });
      }
      if (cur) {
        await db
          .update(schema.weekGoals)
          .set({
            text: nextText,
            applicationsTarget: nextApps,
            focusHoursTargetX10: nextHoursX10,
            updatedAt: now,
          })
          .where(eq(schema.weekGoals.id, cur.id));
        return jsonContent({
          weekStart,
          action: "updated",
          goal: { text: nextText, applicationsTarget: nextApps, focusHoursTarget: nextHoursX10 === null ? null : nextHoursX10 / 10 },
        });
      }
      await db.insert(schema.weekGoals).values({
        userId: user.id,
        weekStart,
        text: nextText,
        applicationsTarget: nextApps,
        focusHoursTargetX10: nextHoursX10,
      });
      return jsonContent({
        weekStart,
        action: "created",
        goal: { text: nextText, applicationsTarget: nextApps, focusHoursTarget: nextHoursX10 === null ? null : nextHoursX10 / 10 },
      });
    },
  );
}
