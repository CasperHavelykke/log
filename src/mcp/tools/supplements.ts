import { and, asc, between, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeOfDayEnum = z.enum(["morning", "midday", "evening", "night"]);

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shapeSupplement(row: typeof schema.supplements.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    defaultDoseAmount:
      row.defaultDoseAmountX100 === null ? null : row.defaultDoseAmountX100 / 100,
    defaultDoseUnit: row.defaultDoseUnit,
    defaultTimeOfDay: row.defaultTimeOfDay,
    notes: row.notes,
    archived: row.archived,
  };
}

function shapeIntake(row: typeof schema.supplementIntakes.$inferSelect) {
  return {
    id: row.id,
    supplementId: row.supplementId,
    name: row.name,
    date: row.date,
    doseAmount: row.doseAmountX100 === null ? null : row.doseAmountX100 / 100,
    doseUnit: row.doseUnit,
    timeOfDay: row.timeOfDay,
    note: row.note,
  };
}

export function registerSupplementTools(server: McpServer) {
  server.registerTool(
    "list_supplements",
    {
      title: "List tilskud i biblioteket",
      description:
        "Returnerer brugerens kosttilskuds-bibliotek (det faste sortiment). Som standard kun ikke-arkiverede.",
      inputSchema: {
        includeArchived: z.boolean().default(false),
      },
    },
    async ({ includeArchived }) => {
      const user = await getActiveUser();
      const rows = includeArchived
        ? await db
            .select()
            .from(schema.supplements)
            .where(eq(schema.supplements.userId, user.id))
            .orderBy(asc(schema.supplements.name))
        : await db
            .select()
            .from(schema.supplements)
            .where(
              and(
                eq(schema.supplements.userId, user.id),
                eq(schema.supplements.archived, false),
              ),
            )
            .orderBy(asc(schema.supplements.name));
      return jsonContent(rows.map(shapeSupplement));
    },
  );

  server.registerTool(
    "create_supplement",
    {
      title: "Opret nyt tilskud i biblioteket",
      description:
        "Tilføjer et tilskud til brugerens bibliotek. Hvis navnet allerede findes (case-insensitive), returneres det eksisterende i stedet.",
      inputSchema: {
        name: z.string().min(1).max(120),
        defaultDoseAmount: z
          .number()
          .min(0)
          .nullable()
          .optional()
          .describe("Standard-dosis som decimaltal (fx 1.5 for 1,5 mg)."),
        defaultDoseUnit: z
          .string()
          .max(20)
          .nullable()
          .optional()
          .describe("Enhed: 'mg', 'g', 'μg', 'IU', 'ml' osv."),
        defaultTimeOfDay: timeOfDayEnum.nullable().optional(),
        notes: z.string().max(2_000).nullable().optional(),
      },
    },
    async (args) => {
      const user = await getActiveUser();
      const trimmed = args.name.trim();
      const existing = await db
        .select()
        .from(schema.supplements)
        .where(eq(schema.supplements.userId, user.id));
      const lower = trimmed.toLowerCase();
      const match = existing.find((s) => s.name.toLowerCase() === lower);
      if (match) {
        if (match.archived) {
          await db
            .update(schema.supplements)
            .set({ archived: false })
            .where(eq(schema.supplements.id, match.id));
        }
        return jsonContent(shapeSupplement({ ...match, archived: false }));
      }
      const inserted = await db
        .insert(schema.supplements)
        .values({
          userId: user.id,
          name: trimmed,
          defaultDoseAmountX100:
            args.defaultDoseAmount === null || args.defaultDoseAmount === undefined
              ? null
              : Math.round(args.defaultDoseAmount * 100),
          defaultDoseUnit: args.defaultDoseUnit ?? null,
          defaultTimeOfDay: args.defaultTimeOfDay ?? null,
          notes: args.notes ?? null,
        })
        .returning();
      return jsonContent(shapeSupplement(inserted[0]));
    },
  );

  server.registerTool(
    "log_supplement",
    {
      title: "Log et tilskuds-indtag",
      description:
        "Registrerer at brugeren tog et tilskud. Angiv enten supplementId eller supplementName. Hvis navnet ikke findes i biblioteket, oprettes det automatisk med de medsendte defaults.",
      inputSchema: {
        supplementId: z
          .number()
          .int()
          .optional()
          .describe("ID for tilskuddet (foretrukket hvis kendt)."),
        supplementName: z
          .string()
          .min(1)
          .max(120)
          .optional()
          .describe("Navn på tilskuddet. Auto-opretter hvis ukendt."),
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("YYYY-MM-DD. Standard: i dag."),
        doseAmount: z
          .number()
          .min(0)
          .nullable()
          .optional()
          .describe(
            "Dosis som decimaltal. Hvis undladt bruges tilskuddets standard.",
          ),
        doseUnit: z.string().max(20).nullable().optional(),
        timeOfDay: timeOfDayEnum.nullable().optional(),
        note: z.string().max(2_000).nullable().optional(),
      },
    },
    async (args) => {
      const user = await getActiveUser();
      let supplement: typeof schema.supplements.$inferSelect | undefined;

      let name = "";
      let supplementIdForAttribution: number | null = null;

      if (args.supplementId !== undefined) {
        const rows = await db
          .select()
          .from(schema.supplements)
          .where(
            and(
              eq(schema.supplements.id, args.supplementId),
              eq(schema.supplements.userId, user.id),
            ),
          )
          .limit(1);
        supplement = rows[0];
        if (!supplement) return errorContent("Tilskud ikke fundet.");
        name = supplement.name;
        supplementIdForAttribution = supplement.id;
      } else if (args.supplementName) {
        // Find template med matchende navn for defaults — men kræv det ikke.
        const lower = args.supplementName.trim().toLowerCase();
        const existing = await db
          .select()
          .from(schema.supplements)
          .where(eq(schema.supplements.userId, user.id));
        supplement = existing.find((s) => s.name.toLowerCase() === lower);
        if (supplement) supplementIdForAttribution = supplement.id;
        name = args.supplementName.trim();
      } else {
        return errorContent(
          "Du skal angive enten supplementId eller supplementName.",
        );
      }

      const doseAmountX100 =
        args.doseAmount === undefined
          ? (supplement?.defaultDoseAmountX100 ?? null)
          : args.doseAmount === null
            ? null
            : Math.round(args.doseAmount * 100);
      const doseUnit =
        args.doseUnit === undefined
          ? (supplement?.defaultDoseUnit ?? null)
          : args.doseUnit;
      const timeOfDay =
        args.timeOfDay === undefined
          ? (supplement?.defaultTimeOfDay ?? null)
          : args.timeOfDay;

      const inserted = await db
        .insert(schema.supplementIntakes)
        .values({
          userId: user.id,
          name,
          supplementId: supplementIdForAttribution,
          date: args.date ?? todayIso(),
          doseAmountX100,
          doseUnit,
          timeOfDay,
          note: args.note ?? null,
        })
        .returning();

      return jsonContent(shapeIntake(inserted[0]));
    },
  );

  server.registerTool(
    "list_supplement_intakes",
    {
      title: "List tilskuds-indtag i interval",
      description: "Returnerer alle tilskuds-indtag mellem to datoer (inklusive).",
      inputSchema: {
        from: z.string().regex(dateRegex),
        to: z.string().regex(dateRegex),
        supplementName: z
          .string()
          .max(120)
          .optional()
          .describe("Valgfrit: filtrér til ét tilskud."),
      },
    },
    async ({ from, to, supplementName }) => {
      if (from > to) return errorContent("Startdato er efter slutdato.");
      const user = await getActiveUser();
      const rows = await db
        .select()
        .from(schema.supplementIntakes)
        .where(
          and(
            eq(schema.supplementIntakes.userId, user.id),
            between(schema.supplementIntakes.date, from, to),
          ),
        )
        .orderBy(asc(schema.supplementIntakes.date));
      const filtered = supplementName
        ? rows.filter(
            (r) => r.name.toLowerCase() === supplementName.toLowerCase(),
          )
        : rows;
      return jsonContent({
        from,
        to,
        intakes: filtered.map(shapeIntake),
      });
    },
  );

  server.registerTool(
    "supplement_summary",
    {
      title: "Tilskuds-oversigt for sidste N dage",
      description:
        "Aggregerer frekvens og gennemsnitsdosis pr. tilskud over de sidste N dage. Bruges fx til 'hvor ofte tog jeg X' eller 'hvilke tilskud tager jeg mest'.",
      inputSchema: {
        days: z.number().int().min(1).max(365).default(30),
      },
    },
    async ({ days }) => {
      const user = await getActiveUser();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

      // Aggregér efter navn (case-insensitive), ikke supplementId.
      // Intakes er bundet til navnet — template-tilskuddet kan være slettet.
      const rows = await db
        .select()
        .from(schema.supplementIntakes)
        .where(
          and(
            eq(schema.supplementIntakes.userId, user.id),
            between(schema.supplementIntakes.date, startIso, todayIso()),
          ),
        );

      type Agg = {
        name: string;
        days: Set<string>;
        intakes: number;
        doseSum: number;
        doseCount: number;
        unit: string | null;
      };
      const agg = new Map<string, Agg>();
      for (const r of rows) {
        const key = r.name.trim().toLowerCase();
        if (!key) continue;
        const a = agg.get(key) ?? {
          name: r.name,
          days: new Set<string>(),
          intakes: 0,
          doseSum: 0,
          doseCount: 0,
          unit: null,
        };
        a.days.add(r.date);
        a.intakes += 1;
        if (r.doseAmountX100 !== null) {
          a.doseSum += r.doseAmountX100 / 100;
          a.doseCount += 1;
        }
        if (a.unit === null && r.doseUnit) a.unit = r.doseUnit;
        agg.set(key, a);
      }

      const summary = [...agg.values()]
        .map((a) => ({
          name: a.name,
          uniqueDays: a.days.size,
          intakes: a.intakes,
          avgDose:
            a.doseCount === 0
              ? null
              : Math.round((a.doseSum / a.doseCount) * 100) / 100,
          unit: a.unit,
          frequency: Math.round((a.days.size / days) * 100) / 100,
        }))
        .sort((a, b) => b.uniqueDays - a.uniqueDays);

      return jsonContent({
        rangeDays: days,
        from: startIso,
        summary,
      });
    },
  );
}
