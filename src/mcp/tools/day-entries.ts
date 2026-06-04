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
    headache: row.headache,
    headacheIntensity: row.headacheIntensity,
    iskiasPain: row.iskiasPain,
    alcoholUnits: row.alcoholUnits,
    constipation: row.constipation,
    constipationPain: row.constipationPain,
    seborrheicDermatitis: row.seborrheicDermatitis,
    didExercise: row.didExercise,
    exerciseIntensity: row.exerciseIntensity,
    sleepHours: row.sleepHours === null ? null : row.sleepHours / 10,
    sleepQuality: row.sleepQuality,
    mood: row.mood,
    energy: row.energy,
    workNotes: row.workNotes,
    healthNotes: row.healthNotes,
    dayNotes: row.dayNotes,
    wentWell: row.wentWell,
    nextStep: row.nextStep,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    kcal:
      row.carbsG !== null && row.proteinG !== null && row.fatG !== null
        ? row.carbsG * 4 + row.proteinG * 4 + row.fatG * 9
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
        "Henter dagens logbogsindgang (helbred, søvn, humør, notater) for en bestemt dato. Bruger dags dato hvis ingen angives.",
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
        "Aggregerer hovedpine, søvn, humør og energi over de sidste N dage. Bruges fx til 'hvordan har min hovedpine været på det seneste'.",
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
      const headacheDays = rows.filter((r) => r.headache);
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
        headache: {
          days: headacheDays.length,
          avgIntensity: avg(
            headacheDays
              .map((r) => r.headacheIntensity)
              .filter((v): v is number => v !== null),
          ),
        },
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
        "Skriver helbreds- og notatfelter for en bestemt dato. Felter der ikke angives bevares (eksisterende række) eller forbliver null (ny række). Sæt headache=true OG headacheIntensity=null for at logge hovedpine uden intensitet.",
      inputSchema: {
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("Dato YYYY-MM-DD. Standard: i dag."),
        headache: z.boolean().optional(),
        headacheIntensity: z
          .number()
          .int()
          .min(1)
          .max(10)
          .nullable()
          .optional()
          .describe("1-10. Sættes til null hvis headache=false."),
        iskiasPain: z
          .number()
          .int()
          .min(1)
          .max(5)
          .nullable()
          .optional()
          .describe("Iskias-smerte 1-5. Null = ingen / ikke logget."),
        alcoholUnits: z
          .number()
          .int()
          .min(0)
          .max(50)
          .nullable()
          .optional()
          .describe("Antal genstande indtaget. 0 eller null = ingen."),
        constipation: z.boolean().optional(),
        constipationPain: z
          .number()
          .int()
          .min(1)
          .max(5)
          .nullable()
          .optional()
          .describe("Smerte ved forstoppelse 1-5. Null hvis ingen forstoppelse."),
        seborrheicDermatitis: z
          .number()
          .int()
          .min(1)
          .max(5)
          .nullable()
          .optional()
          .describe("Skæleksem-niveau 1-5. Null hvis ikke aktivt."),
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

      const headache = args.headache ?? existing?.headache ?? false;
      const headacheIntensity = headache
        ? (args.headacheIntensity ?? existing?.headacheIntensity ?? null)
        : null;
      const constipation = args.constipation ?? existing?.constipation ?? false;
      const constipationPain = constipation
        ? (args.constipationPain ?? existing?.constipationPain ?? null)
        : null;
      const sleepHoursX10 =
        args.sleepHours === undefined
          ? (existing?.sleepHours ?? null)
          : args.sleepHours === null
            ? null
            : Math.round(args.sleepHours * 10);

      const fields = {
        headache,
        headacheIntensity,
        iskiasPain:
          args.iskiasPain === undefined
            ? (existing?.iskiasPain ?? null)
            : args.iskiasPain,
        alcoholUnits:
          args.alcoholUnits === undefined
            ? (existing?.alcoholUnits ?? null)
            : args.alcoholUnits,
        constipation,
        constipationPain,
        seborrheicDermatitis:
          args.seborrheicDermatitis === undefined
            ? (existing?.seborrheicDermatitis ?? null)
            : args.seborrheicDermatitis,
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
