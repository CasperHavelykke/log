import "server-only";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayKcal } from "@/lib/kcal";
import { addDaysIso, todayIsoDate } from "@/lib/date";
import { occursOn } from "@/lib/plan";
import { weeklyNutrition, type WeekRow } from "@/lib/nutrition-weeks";

export type Range = { min: number | null; max: number | null };

export type TodayIntake = {
  kcal: number | null;
  drinkKcal: number;
  carbsG: number | null;
  fiberG: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  proteinG: number | null;
  alcoholUnits: number | null;
  // Seneste ændring af dagens række (ISO) — "Sidst logget kl." i info-dialogen.
  updatedAt: string | null;
};

export type Targets = {
  kcal: Range;
  carbs: Range;
  fiber: Range;
  fat: Range;
  saturatedFat: Range;
  protein: Range;
};

export type DayPoint = {
  date: string;
  kcal: number | null;
  saturatedFat: number | null;
  weight: number | null;
};

export type CholesterolData = {
  today: string;
  intake: TodayIntake;
  // null = ingen ernærings-plan gælder i dag → bjælker uden zone.
  targets: Targets | null;
  weight: {
    latestKg: number | null;
    latestDate: string | null;
    // Seneste vejning mod første uges gennemsnit i perioden; null = for lidt data.
    deltaKg: number | null;
  };
  history: {
    from: string;
    days: DayPoint[];
    weeks: WeekRow[];
  };
};

const HISTORY_WEEKS = 4;

export async function loadCholesterolData(
  userId: number,
): Promise<CholesterolData> {
  const today = todayIsoDate();

  const [entryRows, planRows, history] = await Promise.all([
    db
      .select()
      .from(schema.dayEntries)
      .where(
        and(eq(schema.dayEntries.userId, userId), eq(schema.dayEntries.date, today)),
      )
      .limit(1),
    db
      .select()
      .from(schema.planItems)
      .where(
        and(
          eq(schema.planItems.userId, userId),
          eq(schema.planItems.kind, "nutrition"),
        ),
      ),
    weeklyNutrition(userId, HISTORY_WEEKS),
  ]);

  const entry = entryRows[0] ?? null;
  const k = dayKcal({
    carbsG: entry?.carbsG ?? null,
    proteinG: entry?.proteinG ?? null,
    fatG: entry?.fatG ?? null,
    fiberG: entry?.fiberG ?? null,
    alcoholUnits: entry?.alcoholUnits ?? null,
  });
  const intake: TodayIntake = {
    kcal: k.totalKcal,
    drinkKcal: k.drinkKcal,
    carbsG: entry?.carbsG ?? null,
    fiberG: entry?.fiberG ?? null,
    fatG: entry?.fatG ?? null,
    saturatedFatG: entry?.saturatedFatG ?? null,
    proteinG: entry?.proteinG ?? null,
    alcoholUnits: entry?.alcoholUnits ?? null,
    updatedAt: entry?.updatedAt ?? null,
  };

  // Dagens ernærings-mål: første plan der gælder i dag (samme regel som
  // Dagens plan). AI'en sætter og justerer den via upsert_plan_item.
  const plan = planRows
    .filter((i) => occursOn(i, today))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)[0];
  const targets: Targets | null = plan
    ? {
        kcal: { min: plan.kcalTarget, max: plan.kcalMax },
        carbs: { min: plan.carbsTargetG, max: plan.carbsMaxG },
        fiber: { min: plan.fiberTargetG, max: plan.fiberMaxG },
        fat: { min: plan.fatTargetG, max: plan.fatMaxG },
        saturatedFat: { min: plan.saturatedFatTargetG, max: plan.saturatedFatMaxG },
        protein: { min: plan.proteinTargetG, max: plan.proteinMaxG },
      }
    : null;

  // Dag-for-dag med tomme datoer udfyldt, så grafen har én søjleplads pr. dag.
  const byDate = new Map(history.days.map((d) => [d.date, d]));
  const days: DayPoint[] = [];
  for (let d = history.from; d <= today; d = addDaysIso(d, 1)) {
    const row = byDate.get(d);
    days.push({
      date: d,
      kcal: row ? dayKcal(row).totalKcal : null,
      saturatedFat: row?.saturatedFatG ?? null,
      weight: row?.weightX10 != null ? row.weightX10 / 10 : null,
    });
  }

  // Vægt: seneste vejning i perioden, og forskel til første uge med vejning.
  const weighIns = history.days.filter((d) => d.weightX10 !== null);
  const latest = weighIns[weighIns.length - 1] ?? null;
  const firstWeekWithWeight = history.weeks.find((w) => w.avgWeightKg !== null);
  const latestWeekStart = latest
    ? history.weeks.filter((w) => w.weekStart <= latest.date).at(-1)?.weekStart
    : null;
  const deltaKg =
    latest &&
    firstWeekWithWeight &&
    firstWeekWithWeight.avgWeightKg !== null &&
    firstWeekWithWeight.weekStart !== latestWeekStart
      ? Math.round((latest.weightX10! / 10 - firstWeekWithWeight.avgWeightKg) * 10) / 10
      : null;

  return {
    today,
    intake,
    targets,
    weight: {
      latestKg: latest ? latest.weightX10! / 10 : null,
      latestDate: latest?.date ?? null,
      deltaKg,
    },
    history: { from: history.from, days, weeks: history.weeks },
  };
}
