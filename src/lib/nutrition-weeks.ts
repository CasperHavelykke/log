import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayKcal } from "@/lib/kcal";
import { addDaysIso, mondayOf, todayIsoDate } from "@/lib/date";

// Kcal, mættet fedt og vægt uge for uge (kalenderuger fra mandag). Deles af
// MCP-værktøjet weekly_nutrition_summary og kolesterol-visningens historik,
// så det AI'en regner på og det brugeren ser er ens.
export type WeekRow = {
  weekStart: string;
  loggedDays: number;
  kcalDays: number;
  avgKcal: number | null;
  saturatedFatDays: number;
  avgSaturatedFatG: number | null;
  weightDays: number;
  avgWeightKg: number | null;
};

export type WeeklyNutrition = {
  from: string;
  to: string;
  weeks: WeekRow[];
  // Rå dage i perioden — til dag-for-dag-grafer.
  days: (typeof schema.dayEntries.$inferSelect)[];
};

function avg(xs: number[], decimals: number): number | null {
  if (xs.length === 0) return null;
  const f = 10 ** decimals;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * f) / f;
}

export async function weeklyNutrition(
  userId: number,
  weeks: number,
): Promise<WeeklyNutrition> {
  // Start på mandag, så tabellen følger kalenderuger.
  const today = todayIsoDate();
  const thisMonday = mondayOf(new Date());
  const startIso = addDaysIso(thisMonday, -(weeks - 1) * 7);

  const rows = await db
    .select()
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, userId),
        gte(schema.dayEntries.date, startIso),
      ),
    )
    .orderBy(schema.dayEntries.date);

  // Én spand pr. uge, nøglet på mandagens dato. Tomme uger er med som
  // nul-rækker, så AI'en ikke tror at en uge uden data ikke fandtes.
  type Bucket = {
    weekStart: string;
    kcal: number[];
    saturatedFat: number[];
    weight: number[];
    loggedDays: number;
  };
  const buckets = new Map<string, Bucket>();
  for (let i = 0; i < weeks; i++) {
    const weekStart = addDaysIso(startIso, i * 7);
    buckets.set(weekStart, {
      weekStart,
      kcal: [],
      saturatedFat: [],
      weight: [],
      loggedDays: 0,
    });
  }

  for (const row of rows) {
    const bucket = buckets.get(mondayOf(new Date(`${row.date}T00:00:00`)));
    if (!bucket) continue;
    bucket.loggedDays++;
    const { totalKcal } = dayKcal(row);
    if (totalKcal !== null) bucket.kcal.push(totalKcal);
    if (row.saturatedFatG !== null) bucket.saturatedFat.push(row.saturatedFatG);
    if (row.weightX10 !== null) bucket.weight.push(row.weightX10 / 10);
  }

  const table: WeekRow[] = [...buckets.values()].map((b) => ({
    weekStart: b.weekStart,
    loggedDays: b.loggedDays,
    kcalDays: b.kcal.length,
    avgKcal: avg(b.kcal, 0),
    saturatedFatDays: b.saturatedFat.length,
    avgSaturatedFatG: avg(b.saturatedFat, 0),
    weightDays: b.weight.length,
    avgWeightKg: avg(b.weight, 1),
  }));

  return { from: startIso, to: today, weeks: table, days: rows };
}
