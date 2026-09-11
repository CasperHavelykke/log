// Planlæggerens forekomst-logik. Forekomster materialiseres ikke i DB —
// de beregnes ud fra scheduleType, så en plan kan ændres uden oprydning.
//
//   weekdays : fast ugedags-sæt ("0,2,4" — 0=mandag..6=søndag)
//   interval : hver N. dag i FAST kalender-rytme fra anchorDate.
//              En misset dag skrider ikke — næste forekomst ligger fast.
//   monthly  : månedligt på anchorDates dag-i-måneden, clampet til
//              månedens sidste dag (anker d. 31 → 28./29. februar).

import type { PlanItem, PlanKind, PlanScheduleType } from "@/db/schema";

// Klient-sikker spejling af plan_items-rækken (uden userId/timestamps).
export type PlanItemData = {
  id: number;
  kind: PlanKind;
  projectId: number | null;
  supplementId: number | null;
  workoutTemplateId: number | null;
  label: string | null;
  scheduleType: PlanScheduleType;
  weekdays: string | null;
  intervalDays: number | null;
  anchorDate: string | null;
  timeOfDay: string | null;
  minutesPlanned: number | null;
  kcalTarget: number | null;
  carbsTargetG: number | null;
  proteinTargetG: number | null;
  fatTargetG: number | null;
  fiberTargetG: number | null;
  paused: boolean;
};

export function toPlanItemData(row: PlanItem): PlanItemData {
  return {
    id: row.id,
    kind: row.kind as PlanKind,
    projectId: row.projectId,
    supplementId: row.supplementId,
    workoutTemplateId: row.workoutTemplateId,
    label: row.label,
    scheduleType: row.scheduleType as PlanScheduleType,
    weekdays: row.weekdays,
    intervalDays: row.intervalDays,
    anchorDate: row.anchorDate,
    timeOfDay: row.timeOfDay,
    minutesPlanned: row.minutesPlanned,
    kcalTarget: row.kcalTarget,
    carbsTargetG: row.carbsTargetG,
    proteinTargetG: row.proteinTargetG,
    fatTargetG: row.fatTargetG,
    fiberTargetG: row.fiberTargetG,
    paused: row.paused,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Ugedag med mandag=0..søndag=6 (JS har søndag=0).
function mondayWeekday(iso: string): number {
  return (new Date(`${iso}T00:00:00`).getDay() + 6) % 7;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((to - from) / DAY_MS);
}

export function parseWeekdays(weekdays: string | null): number[] {
  if (!weekdays) return [];
  return weekdays
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

type ScheduleFields = Pick<
  PlanItem,
  "scheduleType" | "weekdays" | "intervalDays" | "anchorDate" | "paused"
>;

// Forekommer planen på datoen? Pausede planer forekommer aldrig.
export function occursOn(item: ScheduleFields, dateIso: string): boolean {
  if (item.paused) return false;
  if (item.scheduleType === "weekdays") {
    return parseWeekdays(item.weekdays).includes(mondayWeekday(dateIso));
  }
  if (!item.anchorDate || dateIso < item.anchorDate) return false;
  if (item.scheduleType === "interval") {
    const n = item.intervalDays ?? 1;
    if (n < 1) return false;
    return daysBetween(item.anchorDate, dateIso) % n === 0;
  }
  if (item.scheduleType === "monthly") {
    const anchorDay = Number(item.anchorDate.slice(8, 10));
    const day = Number(dateIso.slice(8, 10));
    const year = Number(dateIso.slice(0, 4));
    const month = Number(dateIso.slice(5, 7));
    const daysInMonth = new Date(year, month, 0).getDate();
    return day === Math.min(anchorDay, daysInMonth);
  }
  return false;
}

// Summér dagens indtag for et tilskud mod standard-dosen (×100-heltal).
// Regler: indtag uden dosis tæller som én standard-dosis; indtag uden
// enhed antages at være i standard-enheden; indtag i en ANDEN enhed
// tælles ikke med (vi konverterer ikke mg↔g — hellere undertælle end lyve).
export function sumSupplementDoseX100(
  intakes: {
    supplementId: number | null;
    doseAmountX100: number | null;
    doseUnit: string | null;
  }[],
  supplementId: number,
  defaultDoseX100: number | null,
  defaultUnit: string | null,
): number {
  const unitNorm = (defaultUnit ?? "").trim().toLowerCase();
  let sum = 0;
  for (const i of intakes) {
    if (i.supplementId !== supplementId) continue;
    if (i.doseAmountX100 === null) {
      sum += defaultDoseX100 ?? 0;
      continue;
    }
    const iUnit = (i.doseUnit ?? "").trim().toLowerCase();
    if (iUnit === "" || iUnit === unitNorm) sum += i.doseAmountX100;
  }
  return sum;
}

export function fmtDoseX100(x100: number): string {
  return (x100 / 100).toString().replace(".", ",");
}

const WEEKDAY_SHORT = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

// Menneskelig beskrivelse af rytmen, til visning i editorer og på kortet.
export function scheduleLabel(item: ScheduleFields): string {
  if (item.scheduleType === "weekdays") {
    const days = parseWeekdays(item.weekdays);
    if (days.length === 7) return "hver dag";
    if (days.length === 0) return "ingen dage valgt";
    return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
  }
  if (item.scheduleType === "interval") {
    const n = item.intervalDays ?? 1;
    if (n === 1) return "hver dag";
    if (n === 7) return "hver uge";
    if (n === 14) return "hver 14. dag";
    return `hver ${n}. dag`;
  }
  if (item.scheduleType === "monthly") {
    const day = item.anchorDate ? Number(item.anchorDate.slice(8, 10)) : null;
    return day !== null ? `månedligt d. ${day}.` : "månedligt";
  }
  return "";
}
