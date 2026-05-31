import { and, asc, eq, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import { StatistikClient, type DataPoint } from "./statistik-client";

export const metadata = { title: "Statistik | Log" };

export default async function StatistikPage() {
  const user = await requireUser();

  const [dayEntries, sleepEntries, completedFasts] = await Promise.all([
    db
      .select()
      .from(schema.dayEntries)
      .where(eq(schema.dayEntries.userId, user.id))
      .orderBy(asc(schema.dayEntries.date)),
    db
      .select()
      .from(schema.sleepEntries)
      .where(eq(schema.sleepEntries.userId, user.id))
      .orderBy(asc(schema.sleepEntries.date)),
    db
      .select()
      .from(schema.fasts)
      .where(
        and(eq(schema.fasts.userId, user.id), isNotNull(schema.fasts.endedAt)),
      )
      .orderBy(asc(schema.fasts.startedAt)),
  ]);

  const byDate = new Map<string, DataPoint>();
  const ensure = (date: string): DataPoint => {
    let row = byDate.get(date);
    if (!row) {
      row = { date };
      byDate.set(date, row);
    }
    return row;
  };

  for (const d of dayEntries) {
    const row = ensure(d.date);
    if (d.mood != null) row.mood = d.mood;
    if (d.energy != null) row.energy = d.energy;
    if (d.sleepQuality != null) row.sleepQuality = d.sleepQuality;
    if (d.headache && d.headacheIntensity != null) {
      row.headache = d.headacheIntensity;
    }
    if (d.iskiasPain != null) row.iskias = d.iskiasPain;
    if (d.seborrheicDermatitis != null) row.derm = d.seborrheicDermatitis;
    if (d.staph != null) row.staph = d.staph;
    if (d.breathingDifficulty != null) row.breathing = d.breathingDifficulty;
    if (d.alcoholUnits != null) row.alcohol = d.alcoholUnits;
    if (d.weightX10 != null) row.weight = d.weightX10 / 10;
    if (d.waistX10 != null) row.waist = d.waistX10 / 10;
    if (d.sleepHours != null) row.sleepHoursManual = d.sleepHours / 10;
  }

  for (const s of sleepEntries) {
    const row = ensure(s.date);
    if (s.durationMin != null) row.sleepHoursGarmin = s.durationMin / 60;
    if (s.score != null) row.sleepScore = s.score;
    if (s.hrvMs != null) row.hrv = s.hrvMs;
    if (s.restingHeartRate != null) row.restingHr = s.restingHeartRate;
    if (s.avgSpO2 != null) row.spo2 = s.avgSpO2;
    if (s.bodyBatteryChange != null) {
      row.bodyBatteryChange = s.bodyBatteryChange;
    }
    if (s.avgStress != null) row.stress = s.avgStress;
  }

  for (const row of byDate.values()) {
    if (typeof row.sleepHoursGarmin === "number") {
      row.sleepHours = row.sleepHoursGarmin;
    } else if (typeof row.sleepHoursManual === "number") {
      row.sleepHours = row.sleepHoursManual;
    }
  }

  for (const f of completedFasts) {
    if (!f.endedAt) continue;
    const endIsoDate = f.endedAt.slice(0, 10);
    const durMs =
      new Date(f.endedAt).getTime() - new Date(f.startedAt).getTime();
    if (!Number.isFinite(durMs) || durMs <= 0) continue;
    const hours = durMs / 3_600_000;
    const row = ensure(endIsoDate);
    const prev = typeof row.fastHours === "number" ? row.fastHours : 0;
    row.fastHours = Math.max(prev, hours);
  }

  const data = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return <StatistikClient data={data} />;
}
