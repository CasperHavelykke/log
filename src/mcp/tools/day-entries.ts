import { and, asc, between, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";
import { effectiveSleepHoursX10, effectiveSleepQuality } from "../../lib/sleep";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shapeEntry(row: typeof schema.dayEntries.$inferSelect) {
  return {
    date: row.date,
    alcoholUnits: row.alcoholUnits,
    didExercise: row.didExercise,
    exerciseIntensity: row.exerciseIntensity,
    sleepHours: row.sleepHours === null ? null : row.sleepHours / 10,
    sleepQuality: row.sleepQuality,
    mood: row.mood,
    energy: row.energy,
    weightKg: row.weightX10 === null ? null : row.weightX10 / 10,
    waistCm: row.waistX10 === null ? null : row.waistX10 / 10,
    workNotes: row.workNotes,
    healthNotes: row.healthNotes,
    dayNotes: row.dayNotes,
    wentWell: row.wentWell,
    nextStep: row.nextStep,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    kcal:
      row.carbsG !== null && row.proteinG !== null && row.fatG !== null
        ? row.carbsG * 4 +
          row.proteinG * 4 +
          row.fatG * 9 +
          (row.fiberG ?? 0) * 2
        : null,
    updatedAt: row.updatedAt,
  };
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function registerDayEntryTools(server: McpServer) {
  server.registerTool(
    "get_day_entry",
    {
      title: "Hent en dags log",
      description:
        "Henter dagens logbogsindgang (helbred, søvn, humør, notater) for en bestemt dato. Bruger dags dato hvis ingen angives. For specifikke helbreds-parametre (hovedpine, iskias osv.) brug get_custom_parameter_values.",
      inputSchema: {
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("Dato som YYYY-MM-DD. Standard: i dag."),
      },
    },
    async ({ date }) => {
      const user = await getActiveUser();
      const target = date ?? todayIso();
      const rows = await db
        .select()
        .from(schema.dayEntries)
        .where(
          and(
            eq(schema.dayEntries.userId, user.id),
            eq(schema.dayEntries.date, target),
          ),
        )
        .limit(1);
      const row = rows[0];
      return jsonContent({
        date: target,
        entry: row ? shapeEntry(row) : null,
      });
    },
  );

  server.registerTool(
    "list_day_entries",
    {
      title: "List logbogsindgange i interval",
      description:
        "Returnerer alle logbogsindgange mellem to datoer (inklusive). Brug fx til at se en uges eller måneds historik.",
      inputSchema: {
        from: z.string().regex(dateRegex).describe("Startdato YYYY-MM-DD"),
        to: z.string().regex(dateRegex).describe("Slutdato YYYY-MM-DD"),
      },
    },
    async ({ from, to }) => {
      if (from > to) return errorContent("Startdato er efter slutdato.");
      const user = await getActiveUser();
      const rows = await db
        .select()
        .from(schema.dayEntries)
        .where(
          and(
            eq(schema.dayEntries.userId, user.id),
            between(schema.dayEntries.date, from, to),
          ),
        )
        .orderBy(asc(schema.dayEntries.date));
      return jsonContent({ from, to, entries: rows.map(shapeEntry) });
    },
  );

  server.registerTool(
    "health_summary",
    {
      title: "Helbredsoversigt for sidste N dage",
      description:
        "Aggregerer søvn, humør og energi over de sidste N dage. For specifikke helbreds-parametre (hovedpine, iskias osv.) brug list_custom_parameters + get_custom_parameter_values.",
      inputSchema: {
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(7)
          .describe("Antal dage tilbage fra i dag (1-365). Standard: 7."),
      },
    },
    async ({ days }) => {
      const user = await getActiveUser();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

      const [rows, sleepRowsRaw] = await Promise.all([
        db
          .select()
          .from(schema.dayEntries)
          .where(
            and(
              eq(schema.dayEntries.userId, user.id),
              gte(schema.dayEntries.date, startIso),
            ),
          )
          .orderBy(desc(schema.dayEntries.date)),
        db
          .select()
          .from(schema.sleepEntries)
          .where(
            and(
              eq(schema.sleepEntries.userId, user.id),
              gte(schema.sleepEntries.date, startIso),
            ),
          ),
      ]);

      const count = rows.length;
      const moodRows = rows.filter((r) => r.mood !== null);
      const energyRows = rows.filter((r) => r.energy !== null);

      const avg = (xs: number[]) =>
        xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

      // Effektiv søvn: Garmin's målte varighed vinder; ellers manuel.
      const sleepByDate = new Map(sleepRowsRaw.map((s) => [s.date, s]));
      const dayByDate = new Map(rows.map((r) => [r.date, r]));
      const allDates = new Set<string>([
        ...rows.map((r) => r.date),
        ...sleepRowsRaw.map((s) => s.date),
      ]);
      const effectiveHours: number[] = [];
      const effectiveQuality: number[] = [];
      for (const date of allDates) {
        const day = dayByDate.get(date);
        const sleep = sleepByDate.get(date);
        const hX10 = effectiveSleepHoursX10(
          day?.sleepHours ?? null,
          sleep?.durationMin ?? null,
        );
        if (hX10 !== null) effectiveHours.push(hX10 / 10);
        const q = effectiveSleepQuality(
          day?.sleepQuality ?? null,
          sleep?.score ?? null,
        );
        if (q !== null) effectiveQuality.push(q);
      }

      return jsonContent({
        rangeDays: days,
        from: startIso,
        loggedDays: count,
        sleep: {
          avgHours: avg(effectiveHours),
          avgQuality: avg(effectiveQuality),
        },
        avgMood: avg(moodRows.map((r) => r.mood!)),
        avgEnergy: avg(energyRows.map((r) => r.energy!)),
      });
    },
  );

  server.registerTool(
    "upsert_day_entry",
    {
      title: "Opret eller opdater en dags log",
      description:
        "Skriver søvn, humør, energi, makroer, vægt og notater for en bestemt dato. Felter der ikke angives bevares (eksisterende række) eller forbliver null (ny række). For helbreds-parametre (hovedpine, iskias osv.) brug set_custom_parameter_value.",
      inputSchema: {
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("Dato YYYY-MM-DD. Standard: i dag."),
        alcoholUnits: z
          .number()
          .int()
          .min(0)
          .max(50)
          .nullable()
          .optional()
          .describe("Antal genstande indtaget. 0 eller null = ingen."),
        sleepHours: z
          .number()
          .min(0)
          .max(24)
          .nullable()
          .optional()
          .describe("Timer som decimaltal, fx 7.5."),
        sleepQuality: z.number().int().min(1).max(4).nullable().optional(),
        didExercise: z
          .boolean()
          .optional()
          .describe("Trænede du i dag? true = ja, false = nej."),
        exerciseIntensity: z
          .enum(["light", "medium", "hard"])
          .nullable()
          .optional()
          .describe(
            "Træningsintensitet (kun relevant hvis didExercise=true): light, medium eller hard.",
          ),
        mood: z.number().int().min(1).max(5).nullable().optional(),
        energy: z.number().int().min(1).max(5).nullable().optional(),
        workNotes: z
          .string()
          .max(10_000)
          .nullable()
          .optional()
          .describe("Fri tekst: arbejdsnoter — hvad blev der lavet i dag."),
        healthNotes: z
          .string()
          .max(10_000)
          .nullable()
          .optional()
          .describe("Fri tekst: helbredsnoter — symptomer, medicin, observationer."),
        dayNotes: z
          .string()
          .max(10_000)
          .nullable()
          .optional()
          .describe(
            "Fri tekst: generelle dagsnoter — hvad skete der ellers i dag (møder, ærinder, sociale ting).",
          ),
        wentWell: z
          .string()
          .max(10_000)
          .nullable()
          .optional()
          .describe("Fri tekst: hvad gik godt i dag."),
        nextStep: z
          .string()
          .max(10_000)
          .nullable()
          .optional()
          .describe("Fri tekst: hvad er næste skridt / hvad starter du med i morgen."),
        carbsG: z
          .number()
          .int()
          .min(0)
          .max(2000)
          .nullable()
          .optional()
          .describe("Kulhydrater i gram for hele dagen."),
        proteinG: z
          .number()
          .int()
          .min(0)
          .max(1000)
          .nullable()
          .optional()
          .describe("Protein i gram for hele dagen."),
        fatG: z
          .number()
          .int()
          .min(0)
          .max(1000)
          .nullable()
          .optional()
          .describe("Fedt i gram for hele dagen."),
        fiberG: z
          .number()
          .int()
          .min(0)
          .max(200)
          .nullable()
          .optional()
          .describe(
            "Kostfibre i gram for hele dagen. SEPARAT fra carbsG — EU-varedeklarationer angiver kulhydrat EKSKL. fibre. Fibre tæller 2 kcal/g i kalorie-beregningen.",
          ),
        weightKg: z
          .number()
          .min(0)
          .max(500)
          .nullable()
          .optional()
          .describe("Vægt i kg som decimaltal, fx 78.5."),
        waistCm: z
          .number()
          .min(0)
          .max(300)
          .nullable()
          .optional()
          .describe("Livvidde i cm som decimaltal, fx 89.5."),
      },
    },
    async (args) => {
      const user = await getActiveUser();
      const target = args.date ?? todayIso();

      const existingRows = await db
        .select()
        .from(schema.dayEntries)
        .where(
          and(
            eq(schema.dayEntries.userId, user.id),
            eq(schema.dayEntries.date, target),
          ),
        )
        .limit(1);
      const existing = existingRows[0];

      const sleepHoursX10 =
        args.sleepHours === undefined
          ? (existing?.sleepHours ?? null)
          : args.sleepHours === null
            ? null
            : Math.round(args.sleepHours * 10);

      const fields = {
        alcoholUnits:
          args.alcoholUnits === undefined
            ? (existing?.alcoholUnits ?? null)
            : args.alcoholUnits,
        weightX10:
          args.weightKg === undefined
            ? (existing?.weightX10 ?? null)
            : args.weightKg === null
              ? null
              : Math.round(args.weightKg * 10),
        waistX10:
          args.waistCm === undefined
            ? (existing?.waistX10 ?? null)
            : args.waistCm === null
              ? null
              : Math.round(args.waistCm * 10),
        sleepHours: sleepHoursX10,
        sleepQuality:
          args.sleepQuality === undefined
            ? (existing?.sleepQuality ?? null)
            : args.sleepQuality,
        mood: args.mood === undefined ? (existing?.mood ?? null) : args.mood,
        energy:
          args.energy === undefined ? (existing?.energy ?? null) : args.energy,
        workNotes:
          args.workNotes === undefined
            ? (existing?.workNotes ?? null)
            : args.workNotes,
        healthNotes:
          args.healthNotes === undefined
            ? (existing?.healthNotes ?? null)
            : args.healthNotes,
        dayNotes:
          args.dayNotes === undefined
            ? (existing?.dayNotes ?? null)
            : args.dayNotes,
        wentWell:
          args.wentWell === undefined ? (existing?.wentWell ?? null) : args.wentWell,
        nextStep:
          args.nextStep === undefined ? (existing?.nextStep ?? null) : args.nextStep,
        carbsG:
          args.carbsG === undefined ? (existing?.carbsG ?? null) : args.carbsG,
        proteinG:
          args.proteinG === undefined ? (existing?.proteinG ?? null) : args.proteinG,
        fatG: args.fatG === undefined ? (existing?.fatG ?? null) : args.fatG,
        fiberG:
          args.fiberG === undefined ? (existing?.fiberG ?? null) : args.fiberG,
        didExercise:
          args.didExercise === undefined
            ? (existing?.didExercise ?? false)
            : args.didExercise,
        exerciseIntensity:
          args.exerciseIntensity === undefined
            ? (existing?.exerciseIntensity ?? null)
            : args.exerciseIntensity,
      };

      const now = new Date().toISOString();
      if (existing) {
        await db
          .update(schema.dayEntries)
          .set({ ...fields, updatedAt: now })
          .where(eq(schema.dayEntries.id, existing.id));
      } else {
        await db.insert(schema.dayEntries).values({
          userId: user.id,
          date: target,
          ...fields,
        });
      }

      const refreshed = await db
        .select()
        .from(schema.dayEntries)
        .where(
          and(
            eq(schema.dayEntries.userId, user.id),
            eq(schema.dayEntries.date, target),
          ),
        )
        .limit(1);

      return jsonContent({
        date: target,
        action: existing ? "updated" : "created",
        entry: refreshed[0] ? shapeEntry(refreshed[0]) : null,
      });
    },
  );
}
