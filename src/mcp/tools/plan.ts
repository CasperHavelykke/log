import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";
import {
  hasIntakeWithName,
  nutritionPlanDone,
  occursOn,
  scheduleLabel,
  sumSupplementDoseByNameX100,
} from "../../lib/plan";
import { dayKcal } from "../../lib/kcal";
import { addDaysIso } from "../../lib/date";

// Planlæggeren: tilbagevendende planer for projekter, kosttilskud, træning,
// ernærings-mål og måltider. Vises som "Dagens plan" på /today.

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shapeItem(
  row: typeof schema.planItems.$inferSelect,
  names: {
    projects: Map<number, string>;
    supplements: Map<number, string>;
    templates: Map<number, string>;
  },
) {
  // Tilskud bindes via NAVNET (label) — se sumSupplementDoseByNameX100.
  const target =
    row.kind === "project" && row.projectId !== null
      ? (names.projects.get(row.projectId) ?? null)
      : row.kind === "training" && row.workoutTemplateId !== null
        ? (names.templates.get(row.workoutTemplateId) ?? null)
        : null;
  return {
    id: row.id,
    kind: row.kind,
    title: target ?? row.label ?? null,
    projectId: row.projectId,
    supplementId: row.supplementId,
    workoutTemplateId: row.workoutTemplateId,
    label: row.label,
    scheduleType: row.scheduleType,
    weekdays: row.weekdays,
    intervalDays: row.intervalDays,
    anchorDate: row.anchorDate,
    schedule: scheduleLabel(row),
    timeOfDay: row.timeOfDay,
    minutesPlanned: row.minutesPlanned,
    doseTarget: row.doseTargetX100 === null ? null : row.doseTargetX100 / 100,
    doseUnit: row.doseUnit,
    kcalTarget: row.kcalTarget,
    kcalMax: row.kcalMax,
    carbsTargetG: row.carbsTargetG,
    carbsMaxG: row.carbsMaxG,
    proteinTargetG: row.proteinTargetG,
    proteinMaxG: row.proteinMaxG,
    fatTargetG: row.fatTargetG,
    fatMaxG: row.fatMaxG,
    fiberTargetG: row.fiberTargetG,
    fiberMaxG: row.fiberMaxG,
    paused: row.paused,
  };
}

async function loadNames(userId: number) {
  const [projects, supplements, templates] = await Promise.all([
    db
      .select({ id: schema.projects.id, name: schema.projects.name })
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId)),
    db
      .select({ id: schema.supplements.id, name: schema.supplements.name })
      .from(schema.supplements)
      .where(eq(schema.supplements.userId, userId)),
    db
      .select({
        id: schema.workoutTemplates.id,
        title: schema.workoutTemplates.title,
      })
      .from(schema.workoutTemplates)
      .where(eq(schema.workoutTemplates.userId, userId)),
  ]);
  return {
    projects: new Map(projects.map((p) => [p.id, p.name])),
    supplements: new Map(supplements.map((s) => [s.id, s.name])),
    templates: new Map(templates.map((t) => [t.id, t.title])),
  };
}

export function registerPlanTools(server: McpServer) {
  server.registerTool(
    "get_today_plan",
    {
      title: "Hent dagens plan",
      description:
        "Returnerer de planlagte poster for datoen (kosttilskud, træning, måltider, projekt-tid, ernærings-mål) med status: done/skipped/postponed/open ('postponed' = udsat til dagen efter; en post udsat i går vises som dagens forekomst). Brug den til at svare på 'hvad skal jeg i dag?'. Tilskuds-planer matcher på NAVN (label): alle dagens indtag med navnet summeres mod planens doseTarget (doseDone viser fremdrift — fx 6 af 12 g); uden doseTarget tæller ét indtag med navnet. Træning er done når en session/didExercise findes; projekt-tid når tidsregistreringen når det planlagte. Ernærings-mål er INTERVALLER per felt (kcalTarget=minimum, kcalMax=loft osv.) — done når alle satte grænser er overholdt af dagens loggede værdier. Projekt-poster kan have checkInAt: dagens faktiske starttidspunkt ('mødt'), sat med mark_plan_item mark='checkin' — brug det når brugeren siger 'jeg sidder ved bordet nu'.",
      inputSchema: {
        date: z
          .string()
          .regex(DATE_RE)
          .optional()
          .describe("ISO-dato; udelades = i dag."),
      },
    },
    async ({ date }) => {
      const user = await getActiveUser();
      const d = date ?? todayIso();
      const [items, marks, checkins, intakes, workouts, entryRows, timeRows, names] =
        await Promise.all([
          db
            .select()
            .from(schema.planItems)
            .where(eq(schema.planItems.userId, user.id)),
          db
            .select()
            .from(schema.planMarks)
            .where(
              and(
                eq(schema.planMarks.userId, user.id),
                // Også gårsdagens marks: en 'postpone' i går = tilflyttet
                // forekomst i dag (ugedags-/månedsplaner).
                inArray(schema.planMarks.date, [addDaysIso(d, -1), d]),
              ),
            ),
          db
            .select()
            .from(schema.planCheckins)
            .where(
              and(
                eq(schema.planCheckins.userId, user.id),
                eq(schema.planCheckins.date, d),
              ),
            ),
          db
            .select()
            .from(schema.supplementIntakes)
            .where(
              and(
                eq(schema.supplementIntakes.userId, user.id),
                eq(schema.supplementIntakes.date, d),
              ),
            ),
          db
            .select({ id: schema.workouts.id })
            .from(schema.workouts)
            .where(
              and(
                eq(schema.workouts.userId, user.id),
                eq(schema.workouts.date, d),
              ),
            ),
          db
            .select()
            .from(schema.dayEntries)
            .where(
              and(
                eq(schema.dayEntries.userId, user.id),
                eq(schema.dayEntries.date, d),
              ),
            )
            .limit(1),
          db
            .select()
            .from(schema.timeEntries)
            .where(
              and(
                eq(schema.timeEntries.userId, user.id),
                eq(schema.timeEntries.date, d),
              ),
            ),
          loadNames(user.id),
        ]);
      const entry = entryRows[0];
      const checkinByItem = new Map(checkins.map((c) => [c.planItemId, c.at]));
      const markByItem = new Map(
        marks.filter((m) => m.date === d).map((m) => [m.planItemId, m.kind]),
      );
      const postponedYesterday = new Set(
        marks
          .filter((m) => m.date === addDaysIso(d, -1) && m.kind === "postpone")
          .map((m) => m.planItemId),
      );

      const due = items
        .filter(
          (i) =>
            occursOn(i, d) ||
            markByItem.get(i.id) === "postpone" ||
            (!i.paused && postponedYesterday.has(i.id)),
        )
        .map((i) => {
          const base = shapeItem(i, names);
          const minutesActual =
            i.kind === "project" && i.projectId !== null
              ? Math.round(
                  timeRows
                    .filter((t) => t.projectId === i.projectId)
                    .reduce((sum, t) => sum + t.hoursX10, 0) * 6,
                )
              : null;
          // Dosis-mål: dagens indtag med planens NAVN summeres mod planens
          // eget mål — chips er kun log-genveje.
          const suppName = i.kind === "supplement" ? (i.label ?? "") : "";
          const doseTarget = i.kind === "supplement" ? i.doseTargetX100 : null;
          const doseDone =
            doseTarget !== null
              ? sumSupplementDoseByNameX100(
                  intakes,
                  suppName,
                  doseTarget,
                  i.doseUnit,
                )
              : null;

          const mark = markByItem.get(i.id);
          let status =
            mark === "skip"
              ? "skipped"
              : mark === "postpone"
                ? "postponed"
                : mark === "done"
                  ? "done"
                  : "open";
          if (status === "open") {
            if (i.kind === "supplement") {
              if (doseTarget !== null) {
                if ((doseDone ?? 0) >= doseTarget) status = "done";
              } else if (hasIntakeWithName(intakes, suppName)) {
                status = "done";
              }
            } else if (
              i.kind === "training" &&
              (workouts.length > 0 || (entry?.didExercise ?? false))
            ) {
              status = "done";
            } else if (
              i.kind === "project" &&
              i.minutesPlanned !== null &&
              (minutesActual ?? 0) >= i.minutesPlanned
            ) {
              status = "done";
            } else if (i.kind === "nutrition") {
              // Interval-mål: done når alle satte grænser er overholdt —
              // samme regel som /today (se nutritionPlanDone).
              const dayK = dayKcal({
                carbsG: entry?.carbsG ?? null,
                proteinG: entry?.proteinG ?? null,
                fatG: entry?.fatG ?? null,
                fiberG: entry?.fiberG ?? null,
                alcoholUnits: entry?.alcoholUnits ?? null,
              });
              if (
                nutritionPlanDone([
                  { actual: dayK.totalKcal, min: i.kcalTarget, max: i.kcalMax },
                  {
                    actual: entry?.carbsG ?? null,
                    min: i.carbsTargetG,
                    max: i.carbsMaxG,
                  },
                  {
                    actual: entry?.proteinG ?? null,
                    min: i.proteinTargetG,
                    max: i.proteinMaxG,
                  },
                  {
                    actual: entry?.fatG ?? null,
                    min: i.fatTargetG,
                    max: i.fatMaxG,
                  },
                  {
                    actual: entry?.fiberG ?? null,
                    min: i.fiberTargetG,
                    max: i.fiberMaxG,
                  },
                ])
              ) {
                status = "done";
              }
            }
          }
          return {
            ...base,
            status,
            minutesActual,
            checkInAt:
              i.kind === "project" ? (checkinByItem.get(i.id) ?? null) : null,
            doseDone: doseDone === null ? null : doseDone / 100,
          };
        });
      return jsonContent({ date: d, count: due.length, items: due });
    },
  );

  server.registerTool(
    "list_plan_items",
    {
      title: "List alle planer",
      description:
        "Returnerer alle planlægger-poster (også pausede og dem der ikke falder i dag) med deres gentagelses-regler. Brug den før upsert for at finde eksisterende id'er.",
      inputSchema: {},
    },
    async () => {
      const user = await getActiveUser();
      const [items, names] = await Promise.all([
        db
          .select()
          .from(schema.planItems)
          .where(eq(schema.planItems.userId, user.id)),
        loadNames(user.id),
      ]);
      return jsonContent({
        count: items.length,
        items: items.map((i) => shapeItem(i, names)),
      });
    },
  );

  server.registerTool(
    "upsert_plan_item",
    {
      title: "Opret/opdatér plan",
      description:
        "Opretter (uden id) eller opdaterer (med id) en planlægger-post. kind: 'project' (kræver projectId, evt. minutesPlanned), 'supplement' (kræver label = tilskuddets NAVN — planer bindes via navnet, alle indtag med navnet tæller; sæt evt. doseTarget+doseUnit som dagens mål), 'training' (evt. workoutTemplateId eller label), 'nutrition' (interval-mål for dagen: *Target = minimum, *Max = loft — kun minimum = 'mindst X', kun loft = 'højst X', begge = interval, fx kcalTarget 2000 + kcalMax 2100), 'meal' (label påkrævet). Gentagelse: scheduleType 'weekdays' (weekdays: '0,2,4' — 0=mandag..6=søndag), 'interval' (intervalDays: hver N. dag i FAST kalender-rytme fra anchorDate — misset dag skrider ikke) eller 'monthly' (anchorDates dag-i-måneden). anchorDate udeladt = i dag.",
      inputSchema: {
        id: z.number().int().optional(),
        kind: z.enum(schema.PLAN_KINDS),
        projectId: z.number().int().nullable().default(null),
        supplementId: z.number().int().nullable().default(null),
        workoutTemplateId: z.number().int().nullable().default(null),
        label: z.string().max(200).nullable().default(null),
        scheduleType: z.enum(schema.PLAN_SCHEDULE_TYPES),
        weekdays: z
          .string()
          .regex(/^[0-6](,[0-6]){0,6}$/)
          .nullable()
          .default(null)
          .describe("Kun for scheduleType 'weekdays'. 0=mandag..6=søndag."),
        intervalDays: z.number().int().min(1).max(365).nullable().default(null),
        anchorDate: z.string().regex(DATE_RE).nullable().default(null),
        timeOfDay: z
          .string()
          .max(50)
          .nullable()
          .default(null)
          .describe("Fritekst, fx 'formiddag' eller '08:30'."),
        minutesPlanned: z.number().int().min(5).max(1440).nullable().default(null),
        doseTarget: z
          .number()
          .min(0)
          .max(100_000)
          .nullable()
          .default(null)
          .describe(
            "supplement: dagens dosis-mål som decimaltal (fx 12 for 12 g). null = binært 'taget i dag'.",
          ),
        doseUnit: z
          .string()
          .max(20)
          .nullable()
          .default(null)
          .describe("supplement: enhed for dosis-målet, fx 'g' eller 'mg'."),
        kcalTarget: z
          .number()
          .int()
          .min(0)
          .max(10_000)
          .nullable()
          .default(null)
          .describe("nutrition: minimum kcal ('mindst')."),
        kcalMax: z
          .number()
          .int()
          .min(0)
          .max(10_000)
          .nullable()
          .default(null)
          .describe("nutrition: maksimum kcal ('højst')."),
        carbsTargetG: z.number().int().min(0).max(2000).nullable().default(null),
        carbsMaxG: z.number().int().min(0).max(2000).nullable().default(null),
        proteinTargetG: z.number().int().min(0).max(1000).nullable().default(null),
        proteinMaxG: z.number().int().min(0).max(1000).nullable().default(null),
        fatTargetG: z.number().int().min(0).max(1000).nullable().default(null),
        fatMaxG: z.number().int().min(0).max(1000).nullable().default(null),
        fiberTargetG: z.number().int().min(0).max(200).nullable().default(null),
        fiberMaxG: z.number().int().min(0).max(200).nullable().default(null),
        paused: z.boolean().default(false),
      },
    },
    async (input) => {
      const user = await getActiveUser();
      if (input.scheduleType === "weekdays" && !input.weekdays) {
        return errorContent("scheduleType 'weekdays' kræver weekdays-feltet");
      }
      if (input.scheduleType === "interval" && !input.intervalDays) {
        return errorContent("scheduleType 'interval' kræver intervalDays");
      }
      if (input.kind === "supplement" && !input.label?.trim()) {
        return errorContent(
          "kind 'supplement' kræver label (tilskuddets navn — planer bindes via navnet)",
        );
      }
      const rangePairs: [number | null, number | null][] = [
        [input.kcalTarget, input.kcalMax],
        [input.carbsTargetG, input.carbsMaxG],
        [input.proteinTargetG, input.proteinMaxG],
        [input.fatTargetG, input.fatMaxG],
        [input.fiberTargetG, input.fiberMaxG],
      ];
      if (
        rangePairs.some(
          ([min, max]) => min !== null && max !== null && max < min,
        )
      ) {
        return errorContent("Maksimum (*Max) skal være mindst lig minimum");
      }
      const now = new Date().toISOString();
      const values = {
        kind: input.kind,
        projectId: input.projectId,
        // Tilskud bindes via navnet — supplementId sættes ikke længere.
        supplementId: null,
        workoutTemplateId: input.workoutTemplateId,
        label: input.label?.trim() || null,
        scheduleType: input.scheduleType,
        weekdays: input.scheduleType === "weekdays" ? input.weekdays : null,
        intervalDays:
          input.scheduleType === "interval" ? input.intervalDays : null,
        anchorDate:
          input.scheduleType === "weekdays"
            ? null
            : (input.anchorDate ?? todayIso()),
        timeOfDay: input.timeOfDay?.trim() || null,
        minutesPlanned: input.kind === "project" ? input.minutesPlanned : null,
        doseTargetX100:
          input.kind === "supplement" && input.doseTarget !== null
            ? Math.round(input.doseTarget * 100)
            : null,
        doseUnit:
          input.kind === "supplement"
            ? input.doseUnit?.trim() || null
            : null,
        kcalTarget: input.kind === "nutrition" ? input.kcalTarget : null,
        kcalMax: input.kind === "nutrition" ? input.kcalMax : null,
        carbsTargetG: input.kind === "nutrition" ? input.carbsTargetG : null,
        carbsMaxG: input.kind === "nutrition" ? input.carbsMaxG : null,
        proteinTargetG:
          input.kind === "nutrition" ? input.proteinTargetG : null,
        proteinMaxG: input.kind === "nutrition" ? input.proteinMaxG : null,
        fatTargetG: input.kind === "nutrition" ? input.fatTargetG : null,
        fatMaxG: input.kind === "nutrition" ? input.fatMaxG : null,
        fiberTargetG: input.kind === "nutrition" ? input.fiberTargetG : null,
        fiberMaxG: input.kind === "nutrition" ? input.fiberMaxG : null,
        paused: input.paused,
        updatedAt: now,
      };
      if (input.id !== undefined) {
        const existing = await db
          .select({ id: schema.planItems.id })
          .from(schema.planItems)
          .where(
            and(
              eq(schema.planItems.id, input.id),
              eq(schema.planItems.userId, user.id),
            ),
          )
          .limit(1);
        if (!existing[0]) return errorContent("Planen findes ikke");
        await db
          .update(schema.planItems)
          .set(values)
          .where(eq(schema.planItems.id, input.id));
        return jsonContent({ ok: true, id: input.id });
      }
      const inserted = await db
        .insert(schema.planItems)
        .values({ userId: user.id, ...values, createdAt: now })
        .returning({ id: schema.planItems.id });
      return jsonContent({ ok: true, id: inserted[0].id });
    },
  );

  server.registerTool(
    "delete_plan_item",
    {
      title: "Slet plan",
      description:
        "Sletter en planlægger-post permanent (historikken — intakes, sessioner, tid — røres ikke). Bekræft med brugeren først.",
      inputSchema: { id: z.number().int() },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const deleted = await db
        .delete(schema.planItems)
        .where(
          and(eq(schema.planItems.id, id), eq(schema.planItems.userId, user.id)),
        )
        .returning({ id: schema.planItems.id });
      if (deleted.length === 0) return errorContent("Planen findes ikke");
      return jsonContent({ ok: true, deletedId: id });
    },
  );

  server.registerTool(
    "mark_plan_item",
    {
      title: "Markér plan-post for en dag",
      description:
        "Sætter dagens markering på en plan-post: 'done' (manuelt klaret — mest til måltider), 'skip' ('ikke i dag' — rører ikke rytmen), 'postpone' ('udsæt til i morgen' — posten vises i morgen i stedet; for interval-planer rykkes ankeret så rytmen fortsætter fra i morgen, mens ugedags-/månedsplaner kun får et engangs-ryk) 'checkin' (registrér at brugeren er I GANG — dagens faktiske starttidspunkt, første tryk gælder; rører ikke done/skip) eller 'clear' (fjern markeringen; en fortrudt udsættelse ruller også interval-ankeret tilbage). Tilskud bør IKKE markeres done manuelt — log i stedet indtaget med log_supplement, så følger status automatisk.",
      inputSchema: {
        id: z.number().int(),
        date: z
          .string()
          .regex(DATE_RE)
          .optional()
          .describe("ISO-dato; udelades = i dag."),
        mark: z.enum(["done", "skip", "postpone", "checkin", "clear"]),
      },
    },
    async ({ id, date, mark }) => {
      const user = await getActiveUser();
      const d = date ?? todayIso();
      const itemRows = await db
        .select()
        .from(schema.planItems)
        .where(
          and(eq(schema.planItems.id, id), eq(schema.planItems.userId, user.id)),
        )
        .limit(1);
      const item = itemRows[0];
      if (!item) return errorContent("Planen findes ikke");
      if (mark === "checkin") {
        const existing = await db
          .select()
          .from(schema.planCheckins)
          .where(
            and(
              eq(schema.planCheckins.planItemId, id),
              eq(schema.planCheckins.date, d),
            ),
          )
          .limit(1);
        if (existing[0]) {
          return jsonContent({ ok: true, id, date: d, checkInAt: existing[0].at });
        }
        const at = new Date().toISOString();
        await db.insert(schema.planCheckins).values({
          userId: user.id,
          planItemId: id,
          date: d,
          at,
        });
        return jsonContent({ ok: true, id, date: d, checkInAt: at });
      }
      const removed = await db
        .delete(schema.planMarks)
        .where(
          and(eq(schema.planMarks.planItemId, id), eq(schema.planMarks.date, d)),
        )
        .returning({ kind: schema.planMarks.kind });
      if (mark !== "clear") {
        await db.insert(schema.planMarks).values({
          userId: user.id,
          planItemId: id,
          date: d,
          kind: mark,
        });
      }
      // Interval-rytmen følger udsættelsen: 'postpone' rykker ankeret til
      // dagen efter, 'clear' af en udsættelse ruller det tilbage (dagen
      // selv er rytme-ækvivalent med det gamle anker).
      if (item.scheduleType === "interval") {
        if (mark === "postpone") {
          await db
            .update(schema.planItems)
            .set({
              anchorDate: addDaysIso(d, 1),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.planItems.id, id));
        } else if (
          mark === "clear" &&
          removed.some((m) => m.kind === "postpone")
        ) {
          await db
            .update(schema.planItems)
            .set({ anchorDate: d, updatedAt: new Date().toISOString() })
            .where(eq(schema.planItems.id, id));
        }
      }
      return jsonContent({ ok: true, id, date: d, mark });
    },
  );
}
