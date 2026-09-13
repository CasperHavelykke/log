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
  doseTargetX100: number | null;
  doseUnit: string | null;
  kcalTarget: number | null;
  kcalMax: number | null;
  carbsTargetG: number | null;
  carbsMaxG: number | null;
  proteinTargetG: number | null;
  proteinMaxG: number | null;
  fatTargetG: number | null;
  fatMaxG: number | null;
  fiberTargetG: number | null;
  fiberMaxG: number | null;
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
    doseTargetX100: row.doseTargetX100,
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

// Ernærings-mål er intervaller: min ("mindst"), max ("højst") eller begge —
// felter uden grænser tæller ikke med. null = feltet er ubundet; false =
// uden for grænserne (intet logget tæller som ikke opfyldt); true = inden for.
export function nutritionRangeSatisfied(
  actual: number | null,
  min: number | null,
  max: number | null,
): boolean | null {
  if (min === null && max === null) return null;
  if (actual === null) return false;
  if (min !== null && actual < min) return false;
  if (max !== null && actual > max) return false;
  return true;
}

// Auto-kryds for en ernærings-plan: ALLE felter med grænser skal være inden
// for dem (mindst ét felt skal have grænser — en tom plan krydses aldrig).
// Tidspunkt på dagen er ligegyldigt: nogle faster og slutter dagen tidligt.
export function nutritionPlanDone(
  fields: { actual: number | null; min: number | null; max: number | null }[],
): boolean {
  let anyBound = false;
  for (const f of fields) {
    const s = nutritionRangeSatisfied(f.actual, f.min, f.max);
    if (s === null) continue;
    anyBound = true;
    if (!s) return false;
  }
  return anyBound;
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

// Summér dagens indtag for et tilskud mod planens dosis-mål (×100-heltal).
// Tilskuds-planer matcher på NAVN (som statistik og intakes gør) — chips
// er kun log-genveje, så alle indtag med navnet tæller, uanset hvilken
// genvej (eller AI) der loggede dem. Regler: indtag uden dosis tæller som
// ét fuldt mål; indtag uden enhed antages at være i målets enhed; indtag
// i en ANDEN enhed tælles ikke (vi konverterer ikke mg↔g — hellere
// undertælle end lyve).
export function sumSupplementDoseByNameX100(
  intakes: {
    name: string;
    doseAmountX100: number | null;
    doseUnit: string | null;
  }[],
  name: string,
  targetX100: number | null,
  targetUnit: string | null,
): number {
  const nameNorm = name.trim().toLowerCase();
  const unitNorm = (targetUnit ?? "").trim().toLowerCase();
  let sum = 0;
  for (const i of intakes) {
    if (i.name.trim().toLowerCase() !== nameNorm) continue;
    if (i.doseAmountX100 === null) {
      sum += targetX100 ?? 0;
      continue;
    }
    const iUnit = (i.doseUnit ?? "").trim().toLowerCase();
    if (iUnit === "" || iUnit === unitNorm) sum += i.doseAmountX100;
  }
  return sum;
}

export function hasIntakeWithName(
  intakes: { name: string }[],
  name: string,
): boolean {
  const nameNorm = name.trim().toLowerCase();
  return intakes.some((i) => i.name.trim().toLowerCase() === nameNorm);
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
