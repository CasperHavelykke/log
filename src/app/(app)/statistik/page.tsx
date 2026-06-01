import { and, asc, eq, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import { StatistikClient, type DataPoint } from "./statistik-client";

export const metadata = { title: "Statistik | Log" };

export default async function StatistikPage() {
  const user = await requireUser();

  const [dayEntries, sleepEntries, completedFasts, supplementIntakes] =
    await Promise.all([
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
          and(
            eq(schema.fasts.userId, user.id),
            isNotNull(schema.fasts.endedAt),
          ),
        )
        .orderBy(asc(schema.fasts.startedAt)),
      db
        .select()
        .from(schema.supplementIntakes)
        .where(eq(schema.supplementIntakes.userId, user.id))
        .orderBy(asc(schema.supplementIntakes.date)),
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

  // Aggregér tilskud per (name+unit) per dato. Hver unik kombination
  // bliver til en dynamisk metric.
  type SuppGroup = {
    key: string;
    displayName: string;
    unit: string | null;
    perDate: Map<string, number>;
  };
  const suppGroups = new Map<string, SuppGroup>();
  for (const i of supplementIntakes) {
    const trimmedName = (i.name ?? "").trim();
    if (!trimmedName) continue;
    const unit = (i.doseUnit ?? "").trim() || null;
    const groupKey = `${trimmedName.toLowerCase()}|${unit ?? ""}`;
    let group = suppGroups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        displayName: trimmedName,
        unit,
        perDate: new Map(),
      };
      suppGroups.set(groupKey, group);
    }
    // doseAmountX100 er dose × 100 (heltal). Hvis ingen dose, regn som 1 (tæller intake).
    const dose =
      i.doseAmountX100 !== null && i.doseAmountX100 !== undefined
        ? i.doseAmountX100 / 100
        : 1;
    const prev = group.perDate.get(i.date) ?? 0;
    group.perDate.set(i.date, prev + dose);
  }

  // Stabil mapping fra groupKey → metric-key (kort, sikker som JS-identifier)
  const supplementMetrics: {
    metricKey: string;
    label: string;
    unit: string;
  }[] = [];
  let suppIdx = 0;
  for (const g of suppGroups.values()) {
    const metricKey = `supp_${suppIdx++}`;
    supplementMetrics.push({
      metricKey,
      label: g.unit ? `${g.displayName} (${g.unit})` : g.displayName,
      unit: g.unit ? ` ${g.unit}` : "",
    });
    for (const [date, total] of g.perDate) {
      const row = ensure(date);
      row[metricKey] = total;
    }
  }
  supplementMetrics.sort((a, b) => a.label.localeCompare(b.label, "da"));

  const data = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return <StatistikClient data={data} supplementMetrics={supplementMetrics} />;
}
