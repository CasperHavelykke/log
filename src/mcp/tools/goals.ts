import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";
import { toGoalView } from "../../lib/goals";

// Årsmål er opt-in (som træningstracking). Tool-listen er statisk, så
// gatingen sker ved kald — med en venlig forklaring.
const DISABLED_MESSAGE =
  "Årsmål er ikke slået til. Brugeren kan aktivere dem under " +
  "Indstillinger → Funktioner → 'Årsmål'.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function requireGoalsEnabled() {
  const user = await getActiveUser();
  if (!user.goalsEnabled) return null;
  return user;
}

async function loadGoalViews(userId: number) {
  const [goalRows, entryRows] = await Promise.all([
    db.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
    db
      .select()
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.userId, userId)),
  ]);
  const byGoal = new Map<number, typeof entryRows>();
  for (const e of entryRows) {
    const list = byGoal.get(e.goalId) ?? [];
    list.push(e);
    byGoal.set(e.goalId, list);
  }
  const today = todayIso();
  return goalRows
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((g) => toGoalView(g, byGoal.get(g.id) ?? [], today));
}

export function registerGoalTools(server: McpServer) {
  server.registerTool(
    "list_goals",
    {
      title: "List årsmål med kurs-status",
      description:
        "Returnerer brugerens langtidsmål (årsmål) med fremdrift og kurs: 'current' er hvor langt brugeren er, 'expected' hvor kursen siger de burde være i dag ved jævnt tempo (start → deadline). current < expected = bagud. Typer: 'count' (optælling — fremskridt logges som deltaer, fx +1 maleri), 'level' (niveau målt af og til, fx følgertal — nyeste måling gælder), 'milestone' (sket/ikke sket inden deadline). Brug den til at svare på 'hvordan går det med mine mål?'.",
      inputSchema: {},
    },
    async () => {
      const user = await requireGoalsEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const views = await loadGoalViews(user.id);
      return jsonContent({ count: views.length, goals: views });
    },
  );

  server.registerTool(
    "log_goal_progress",
    {
      title: "Log fremskridt på et årsmål",
      description:
        "Registrerer fremskridt: for 'count'-mål er value et DELTA (fx 1 for ét færdigt maleri, 2 for to opslag); for 'level'-mål er value den NYE MÅLING (fx 340 følgere — ikke ændringen). Milepæle krydses af med complete_goal i stedet. Find goalId med list_goals. Brug den når brugeren fortæller om fremskridt, fx 'jeg gjorde et maleri færdigt i dag'.",
      inputSchema: {
        goalId: z.number().int(),
        value: z.number().int().describe("Delta (count) eller ny måling (level)."),
        date: z
          .string()
          .regex(DATE_RE)
          .optional()
          .describe("ISO-dato; udelades = i dag."),
        note: z.string().max(500).optional(),
      },
    },
    async ({ goalId, value, date, note }) => {
      const user = await requireGoalsEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const rows = await db
        .select()
        .from(schema.goals)
        .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, user.id)))
        .limit(1);
      const goal = rows[0];
      if (!goal) return errorContent("Målet findes ikke");
      if (goal.kind === "milestone") {
        return errorContent("Milepæle krydses af med complete_goal");
      }
      if (goal.kind === "level" && value < 0) {
        return errorContent("Niveau kan ikke være negativt");
      }
      await db.insert(schema.goalEntries).values({
        userId: user.id,
        goalId: goal.id,
        date: date ?? todayIso(),
        value,
        note: note?.trim() || null,
      });
      const views = await loadGoalViews(user.id);
      return jsonContent({
        ok: true,
        goal: views.find((v) => v.id === goal.id) ?? null,
      });
    },
  );

  server.registerTool(
    "complete_goal",
    {
      title: "Kryds en milepæl af",
      description:
        "Markerer et 'milestone'-mål som nået (eller fortryder med done: false). Kun for milepæle — optællinger og niveauer opdateres med log_goal_progress.",
      inputSchema: {
        goalId: z.number().int(),
        done: z.boolean().default(true),
      },
    },
    async ({ goalId, done }) => {
      const user = await requireGoalsEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const rows = await db
        .select({ id: schema.goals.id, kind: schema.goals.kind })
        .from(schema.goals)
        .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, user.id)))
        .limit(1);
      if (!rows[0]) return errorContent("Målet findes ikke");
      if (rows[0].kind !== "milestone") {
        return errorContent("Kun milepæle kan krydses af");
      }
      await db
        .update(schema.goals)
        .set({
          completedAt: done ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.goals.id, goalId));
      return jsonContent({ ok: true, goalId, done });
    },
  );

  server.registerTool(
    "upsert_goal",
    {
      title: "Opret/opdatér årsmål",
      description:
        "Opretter (uden id) eller opdaterer (med id) et årsmål. kind: 'count' (optælling m. targetValue, fx 40 malerier), 'level' (niveau m. targetValue, fx 1000 følgere) eller 'milestone' (kun deadline). groupLabel grupperer på kortet (fx 'Det du selv bestemmer'). Kursen beregnes lineært fra startDate til deadline.",
      inputSchema: {
        id: z.number().int().optional(),
        title: z.string().min(1).max(200),
        groupLabel: z.string().max(100).nullable().default(null),
        kind: z.enum(schema.GOAL_KINDS),
        targetValue: z
          .number()
          .int()
          .min(1)
          .max(100_000_000)
          .nullable()
          .default(null)
          .describe("Påkrævet for count/level; null for milestone."),
        unit: z.string().max(30).nullable().default(null),
        startDate: z.string().regex(DATE_RE),
        deadline: z.string().regex(DATE_RE),
        note: z.string().max(2_000).nullable().default(null),
      },
    },
    async (input) => {
      const user = await requireGoalsEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      if (input.kind !== "milestone" && input.targetValue === null) {
        return errorContent("count/level kræver targetValue");
      }
      if (input.deadline <= input.startDate) {
        return errorContent("deadline skal ligge efter startDate");
      }
      const now = new Date().toISOString();
      const values = {
        title: input.title.trim(),
        groupLabel: input.groupLabel?.trim() || null,
        kind: input.kind,
        targetValue: input.kind === "milestone" ? null : input.targetValue,
        unit: input.kind === "milestone" ? null : input.unit?.trim() || null,
        startDate: input.startDate,
        deadline: input.deadline,
        note: input.note?.trim() || null,
        updatedAt: now,
      };
      if (input.id !== undefined) {
        const existing = await db
          .select({ id: schema.goals.id })
          .from(schema.goals)
          .where(
            and(eq(schema.goals.id, input.id), eq(schema.goals.userId, user.id)),
          )
          .limit(1);
        if (!existing[0]) return errorContent("Målet findes ikke");
        await db
          .update(schema.goals)
          .set(values)
          .where(eq(schema.goals.id, input.id));
        return jsonContent({ ok: true, id: input.id });
      }
      const inserted = await db
        .insert(schema.goals)
        .values({ userId: user.id, ...values, createdAt: now })
        .returning({ id: schema.goals.id });
      return jsonContent({ ok: true, id: inserted[0].id });
    },
  );

  server.registerTool(
    "delete_goal",
    {
      title: "Slet årsmål",
      description:
        "Sletter et årsmål og hele dets fremskridts-historik permanent. Bekræft med brugeren først.",
      inputSchema: { id: z.number().int() },
    },
    async ({ id }) => {
      const user = await requireGoalsEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const deleted = await db
        .delete(schema.goals)
        .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, user.id)))
        .returning({ id: schema.goals.id });
      if (deleted.length === 0) return errorContent("Målet findes ikke");
      return jsonContent({ ok: true, deletedId: id });
    },
  );
}
