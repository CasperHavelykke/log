import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";
import { countExercises } from "../../lib/workout";

// Avanceret træningstracking er opt-in. Tool-listen er statisk (registreres
// ved serverstart), så gatingen sker ved kald — med en venlig forklaring i
// stedet for en mystisk fejl. Samme mønster som demo-gatingen af uploads.
const DISABLED_MESSAGE =
  "Avanceret træningstracking er ikke slået til. Brugeren kan aktivere den " +
  "under Indstillinger → Funktioner → 'Avanceret træningstracking'. Indtil " +
  "da kan træning stadig markeres på dagen via upsert_day_entry " +
  "(didExercise: true).";

async function requireTrainingEnabled() {
  const user = await getActiveUser();
  if (!user.trainingEnabled) return null;
  return user;
}

function shapeWorkoutSummary(row: typeof schema.workouts.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    durationMin: row.durationMin,
    exerciseCount: countExercises(row.body),
    updatedAt: row.updatedAt,
  };
}

function shapeWorkoutFull(row: typeof schema.workouts.$inferSelect) {
  return {
    ...shapeWorkoutSummary(row),
    body: row.body,
    createdAt: row.createdAt,
  };
}

async function getOwnWorkout(userId: number, id: number) {
  const rows = await db
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// Logget træning sætter didExercise på dagen (ryddes aldrig automatisk —
// brugeren kan have sat flaget manuelt).
async function markDayExercised(userId: number, date: string) {
  const existing = await db
    .select({
      id: schema.dayEntries.id,
      didExercise: schema.dayEntries.didExercise,
    })
    .from(schema.dayEntries)
    .where(
      and(eq(schema.dayEntries.userId, userId), eq(schema.dayEntries.date, date)),
    )
    .limit(1);
  if (existing[0]) {
    if (!existing[0].didExercise) {
      await db
        .update(schema.dayEntries)
        .set({ didExercise: true, updatedAt: new Date().toISOString() })
        .where(eq(schema.dayEntries.id, existing[0].id));
    }
  } else {
    await db.insert(schema.dayEntries).values({
      userId,
      date,
      didExercise: true,
    });
  }
}

const bodyDescription =
  "Fri tekst, én linje per element. En ØVELSE skrives 'Navn — sæt×reps @ vægt', " +
  "fx 'Chin-ups — 4×2 fra failure' eller 'KB press, én arm — 4×6-8 @ 16 kg' " +
  "(vægt-delen er valgfri, reps må være tekst som '6-8 per arm' eller " +
  "'nær failure'). Brug tankestreg med luft omkring (' — ') som separator. " +
  "En linje der ender med kolon ('Til slut:') bliver en under-overskrift. " +
  "Alle andre linjer (pausetider, teknik-tips, prosa) vises som noter — " +
  "intet format er obligatorisk. Brug INGEN manuel nummerering eller bullets.";

export function registerWorkoutTools(server: McpServer) {
  server.registerTool(
    "list_workouts",
    {
      title: "List træningssessioner",
      description:
        "Returnerer brugerens loggede træningssessioner (dato, titel, varighed, antal øvelser), nyeste først. Afgræns evt. med from/to (ISO-datoer). Kræver at avanceret træningstracking er slået til.",
      inputSchema: {
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Medtag kun sessioner fra og med denne dato."),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Medtag kun sessioner til og med denne dato."),
        limit: z.number().int().min(1).max(200).default(50),
      },
    },
    async ({ from, to, limit }) => {
      const user = await requireTrainingEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const conditions = [eq(schema.workouts.userId, user.id)];
      if (from) conditions.push(gte(schema.workouts.date, from));
      if (to) conditions.push(lte(schema.workouts.date, to));
      const rows = await db
        .select()
        .from(schema.workouts)
        .where(and(...conditions))
        .orderBy(desc(schema.workouts.date), desc(schema.workouts.id))
        .limit(limit);
      return jsonContent({
        count: rows.length,
        workouts: rows.map(shapeWorkoutSummary),
      });
    },
  );

  server.registerTool(
    "get_workout",
    {
      title: "Hent træningssession",
      description:
        "Returnerer den fulde session inkl. brødteksten med øvelser, sæt/reps og noter.",
      inputSchema: {
        id: z.number().int(),
      },
    },
    async ({ id }) => {
      const user = await requireTrainingEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const workout = await getOwnWorkout(user.id, id);
      if (!workout) return errorContent("Sessionen findes ikke");
      return jsonContent({ workout: shapeWorkoutFull(workout) });
    },
  );

  server.registerTool(
    "log_workout",
    {
      title: "Log træningssession",
      description:
        "Logger en ny træningssession. Følg body-feltets formatregler nøje — linjeformatet driver visning og fremtidig statistik. Sætter automatisk 'har trænet'-flaget på dagen, så kalender og statistik følger med.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .max(200)
          .describe("Kort titel, fx 'Pull + press' eller 'Løbetur 5 km'."),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Dato sessionen blev udført (ISO). Spørg hvis uklart."),
        durationMin: z
          .number()
          .int()
          .min(1)
          .max(600)
          .nullable()
          .default(null)
          .describe("Varighed i minutter (valgfri)."),
        body: z.string().max(20_000).default("").describe(bodyDescription),
      },
    },
    async (input) => {
      const user = await requireTrainingEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.workouts)
        .values({
          userId: user.id,
          title: input.title.trim(),
          date: input.date,
          durationMin: input.durationMin,
          body: input.body.trim(),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await markDayExercised(user.id, input.date);
      return jsonContent({ ok: true, workout: shapeWorkoutFull(inserted[0]) });
    },
  );

  server.registerTool(
    "update_workout",
    {
      title: "Opdatér træningssession",
      description:
        "Opdaterer felter på en eksisterende session. Udeladte felter røres ikke. body erstattes i sin helhed — hent den nuværende med get_workout først hvis kun en del skal ændres.",
      inputSchema: {
        id: z.number().int(),
        title: z.string().min(1).max(200).optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        durationMin: z.number().int().min(1).max(600).nullable().optional(),
        body: z
          .string()
          .max(20_000)
          .optional()
          .describe(`Samme format som log_workout: ${bodyDescription}`),
      },
    },
    async ({ id, ...patch }) => {
      const user = await requireTrainingEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const workout = await getOwnWorkout(user.id, id);
      if (!workout) return errorContent("Sessionen findes ikke");

      const date = patch.date ?? workout.date;
      await db
        .update(schema.workouts)
        .set({
          title: patch.title !== undefined ? patch.title.trim() : workout.title,
          date,
          durationMin:
            patch.durationMin !== undefined
              ? patch.durationMin
              : workout.durationMin,
          body: patch.body !== undefined ? patch.body.trim() : workout.body,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.workouts.id, id));
      await markDayExercised(user.id, date);

      const updated = await getOwnWorkout(user.id, id);
      return jsonContent({ ok: true, workout: shapeWorkoutFull(updated!) });
    },
  );

  server.registerTool(
    "delete_workout",
    {
      title: "Slet træningssession",
      description:
        "Sletter en session permanent. Kan ikke fortrydes — bekræft med brugeren først. 'Har trænet'-flaget på dagen ryddes IKKE automatisk (det kan være sat manuelt).",
      inputSchema: {
        id: z.number().int(),
      },
    },
    async ({ id }) => {
      const user = await requireTrainingEnabled();
      if (!user) return errorContent(DISABLED_MESSAGE);
      const workout = await getOwnWorkout(user.id, id);
      if (!workout) return errorContent("Sessionen findes ikke");
      await db.delete(schema.workouts).where(eq(schema.workouts.id, id));
      return jsonContent({ ok: true, deletedId: id });
    },
  );
}
