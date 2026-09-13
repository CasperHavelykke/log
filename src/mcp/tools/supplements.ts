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

  server.registerTool(
    "merge_supplement_metric",
    {
      title: "Flet tilskuds-metrik",
      description:
        "Fletter én tilskuds-metrik ind i en anden ved at flytte alle intakes fra (fromName, fromUnit) til (toName, toUnit). Bruges til at rydde op i tastefejl — fx 'Glycin (mg)' der skulle have været 'Glycin (g)', eller 'Lycin' → 'Lysin'. Metrikker på /statistik grupperes efter navn+enhed, så kilden forsvinder automatisk når dens intakes er flyttet. VIGTIGT: kald ALTID først med dryRun=true (default) og vis brugeren hvad der rammes, før du udfører med dryRun=false.",
      inputSchema: {
        fromName: z.string().min(1).max(200).describe("Kildens navn, fx 'Glycin'"),
        fromUnit: z
          .string()
          .max(50)
          .nullable()
          .describe("Kildens enhed, fx 'mg'. null hvis intakes ikke har enhed."),
        toName: z.string().min(1).max(200).describe("Målets navn"),
        toUnit: z
          .string()
          .max(50)
          .nullable()
          .describe("Målets enhed, fx 'g'. null for ingen enhed."),
        valueFactor: z
          .number()
          .positive()
          .default(1)
          .describe(
            "Ganges på dosis-værdierne under flytning. 1 = ren ometiketning (tallene var rigtige, kun enheden forkert). 0.001 = ægte mg→g-konvertering. SPØRG brugeren hvilken situation det er, hvis det er uklart.",
          ),
        dryRun: z
          .boolean()
          .default(true)
          .describe(
            "true (default): rapportér kun hvad der ville ske. false: udfør flytningen.",
          ),
      },
    },
    async ({ fromName, fromUnit, toName, toUnit, valueFactor, dryRun }) => {
      const user = await getActiveUser();
      const from = fromName.trim();
      const to = toName.trim();
      const fromU = fromUnit?.trim() || null;
      const toU = toUnit?.trim() || null;
      if (from.toLowerCase() === to.toLowerCase() && fromU === toU) {
        return errorContent("Kilde og mål er identiske.");
      }

      // Find de ramte intakes (navn matcher case-insensitivt som i statistik).
      const all = await db
        .select()
        .from(schema.supplementIntakes)
        .where(eq(schema.supplementIntakes.userId, user.id));
      const affected = all.filter(
        (i) =>
          i.name.trim().toLowerCase() === from.toLowerCase() &&
          ((i.doseUnit ?? "").trim() || null) === fromU,
      );

      if (affected.length === 0) {
        return errorContent(
          `Ingen intakes matcher '${from}' (${fromU ?? "uden enhed"}).`,
        );
      }

      const preview = affected.map((i) => ({
        id: i.id,
        date: i.date,
        dose: i.doseAmountX100 === null ? null : i.doseAmountX100 / 100,
        newDose:
          i.doseAmountX100 === null
            ? null
            : Math.round(i.doseAmountX100 * valueFactor) / 100,
      }));

      if (dryRun) {
        return jsonContent({
          dryRun: true,
          wouldMove: affected.length,
          from: { name: from, unit: fromU },
          to: { name: to, unit: toU },
          valueFactor,
          intakes: preview,
          hint: "Kald igen med dryRun=false for at udføre — efter brugerens bekræftelse.",
        });
      }

      await db.transaction(async (tx) => {
        for (const i of affected) {
          await tx
            .update(schema.supplementIntakes)
            .set({
              name: to,
              doseUnit: toU,
              doseAmountX100:
                i.doseAmountX100 === null
                  ? null
                  : Math.round(i.doseAmountX100 * valueFactor),
            })
            .where(eq(schema.supplementIntakes.id, i.id));
        }

        // Planer bindes via NAVN — flyt matchende planer med til target-
        // navnet (og skalér/omdøb deres dosis-mål ved enhedsskifte).
        const planRows = await tx
          .select()
          .from(schema.planItems)
          .where(
            and(
              eq(schema.planItems.userId, user.id),
              eq(schema.planItems.kind, "supplement"),
            ),
          );
        for (const p of planRows) {
          const planName = (p.label ?? "").trim().toLowerCase();
          if (planName !== from.toLowerCase()) continue;
          // Dosis-målet skaleres kun når planens enhed matcher source-
          // enheden — ellers flyttes kun navnet.
          const unitMatches =
            ((p.doseUnit ?? "").trim() || null) === fromU;
          await tx
            .update(schema.planItems)
            .set({
              label: to,
              doseUnit: unitMatches ? toU : p.doseUnit,
              doseTargetX100:
                unitMatches && p.doseTargetX100 !== null
                  ? Math.round(p.doseTargetX100 * valueFactor)
                  : p.doseTargetX100,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.planItems.id, p.id));
        }

        // Skabelon-oprydning: hvis target-skabelon findes, slet source-
        // skabelonen; ellers omdøb source til target.
        const templates = await tx
          .select()
          .from(schema.supplements)
          .where(eq(schema.supplements.userId, user.id));
        const sourceTpl = templates.find(
          (t) =>
            t.name.trim().toLowerCase() === from.toLowerCase() &&
            ((t.defaultDoseUnit ?? "").trim() || null) === fromU,
        );
        const targetTpl = templates.find(
          (t) =>
            t.name.trim().toLowerCase() === to.toLowerCase() &&
            ((t.defaultDoseUnit ?? "").trim() || null) === toU,
        );
        if (sourceTpl && targetTpl && sourceTpl.id !== targetTpl.id) {
          await tx
            .delete(schema.supplements)
            .where(eq(schema.supplements.id, sourceTpl.id));
        } else if (sourceTpl && !targetTpl) {
          await tx
            .update(schema.supplements)
            .set({
              name: to,
              defaultDoseUnit: toU,
              defaultDoseAmountX100:
                sourceTpl.defaultDoseAmountX100 === null
                  ? null
                  : Math.round(sourceTpl.defaultDoseAmountX100 * valueFactor),
            })
            .where(eq(schema.supplements.id, sourceTpl.id));
        }
      });

      return jsonContent({
        ok: true,
        moved: affected.length,
        from: { name: from, unit: fromU },
        to: { name: to, unit: toU },
        valueFactor,
      });
    },
  );
}
