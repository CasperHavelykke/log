import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActiveUser } from "../active-user";
import { jsonContent } from "../format";
import { weeklyNutrition } from "../../lib/nutrition-weeks";

export function registerNutritionWeekTools(server: McpServer) {
  server.registerTool(
    "weekly_nutrition_summary",
    {
      title: "Kcal, mættet fedt og vægt uge for uge",
      description:
        "Kcal, mættet fedt og vægt uge for uge (kalenderuger fra mandag), til at skønne og justere kalorie-vedligehold og følge et loft for mættet fedt. Pr. uge: loggedDays, kcalDays (dage med kcal-total), avgKcal (samme beregning som appen: makroer + fibre + alkohol), saturatedFatDays, avgSaturatedFatG, weightDays, avgWeightKg. REGNEREGEL: brug kun uger med mindst 4 kcalDays og mindst 1 vejning. Sammenlign gennemsnits-kcal over 3-4 uger med vægtændringen fra første til sidste brugbare uge. 1 kg ≈ 7700 kcal, så vedligehold ≈ avgKcal − (ændring i kg × 7700) / antal dage i perioden. Ignorér enkeltvejninger der afviger mere end 3 kg fra naboerne (tastefejl). Med under 3 brugbare uger: sig at der mangler data, og skøn ikke. Gem resultatet som interval (±100 kcal) i kcalTarget og kcalMax på ernærings-planen via upsert_plan_item.",
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
      const { from, to, weeks: table } = await weeklyNutrition(user.id, weeks);
      return jsonContent({ from, to, weeks: table });
    },
  );
}
