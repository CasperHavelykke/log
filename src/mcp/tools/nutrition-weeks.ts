import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { jsonContent } from "../format";
import { dayKcal } from "../../lib/kcal";
import { addDaysIso, mondayOf, todayIsoDate } from "../../lib/date";

export function registerNutritionWeekTools(server: McpServer) {
  server.registerTool(
    "weekly_nutrition_summary",
    {
      title: "Kcal og vægt uge for uge",
      description:
        "Kcal og vægt uge for uge (kalenderuger fra mandag), til at skønne og justere kalorie-vedligehold. Pr. uge: loggedDays, kcalDays (dage med kcal-total), avgKcal (samme beregning som appen: makroer + fibre + alkohol), weightDays, avgWeightKg. REGNEREGEL: brug kun uger med mindst 4 kcalDays og mindst 1 vejning. Sammenlign gennemsnits-kcal over 3-4 uger med vægtændringen fra første til sidste brugbare uge. 1 kg ≈ 7700 kcal, så vedligehold ≈ avgKcal − (ændring i kg × 7700) / antal dage i perioden. Ignorér enkeltvejninger der afviger mere end 3 kg fra naboerne (tastefejl). Med under 3 brugbare uger: sig at der mangler data, og skøn ikke. Gem resultatet som interval (±100 kcal) i kcalTarget og kcalMax på ernærings-planen via upsert_plan_item.",
      inputSchema: {
        weeks: z
          .number()
          .int()
          .min(1)
          .max(26)
          .default(4)
          .describe("Antal uger tilbage fra i dag, inkl. indeværende uge. Standard: 4."),
      },
    },
    async ({ weeks }) => {
      const user = await getActiveUser();
      // Start på mandag, så tabellen følger kalenderuger.
      const today = todayIsoDate();
      const thisMonday = mondayOf(new Date());
      const startIso = addDaysIso(thisMonday, -(weeks - 1) * 7);

      const rows = await db
        .select()
        .from(schema.dayEntries)
        .where(
          and(
            eq(schema.dayEntries.userId, user.id),
            gte(schema.dayEntries.date, startIso),
          ),
        )
        .orderBy(schema.dayEntries.date);

      // Én spand pr. uge, nøglet på mandagens dato.
      type Bucket = {
        weekStart: string;
        kcal: number[];
        weight: number[];
        loggedDays: number;
      };
      const buckets = new Map<string, Bucket>();
      for (let i = 0; i < weeks; i++) {
        const weekStart = addDaysIso(startIso, i * 7);
        buckets.set(weekStart, { weekStart, kcal: [], weight: [], loggedDays: 0 });
      }

      for (const row of rows) {
        const bucket = buckets.get(mondayOf(new Date(row.date)));
        if (!bucket) continue;
        bucket.loggedDays++;
        const { totalKcal } = dayKcal(row);
        if (totalKcal !== null) bucket.kcal.push(totalKcal);
        if (row.weightX10 !== null) bucket.weight.push(row.weightX10 / 10);
      }

      const avg = (xs: number[], decimals: number) =>
        xs.length === 0
          ? null
          : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10 ** decimals) / 10 ** decimals;

      const table = [...buckets.values()].map((b) => ({
        weekStart: b.weekStart,
        loggedDays: b.loggedDays,
        kcalDays: b.kcal.length,
        avgKcal: avg(b.kcal, 0),
        weightDays: b.weight.length,
        avgWeightKg: avg(b.weight, 1),
      }));

      return jsonContent({ from: startIso, to: today, weeks: table });
    },
  );
}
