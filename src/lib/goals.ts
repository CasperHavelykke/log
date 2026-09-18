// Årsmålenes kurs-beregning. Et mål har en periode (startDate → deadline)
// og et mål-tal; kursen er den lineære forventning "hvor burde jeg være i
// dag ved jævnt tempo". Det er hele værdien over en statisk tavle: "23 af
// 40" er abstrakt — "kursen siger 27, du er 4 bagud" er handlingsanvisende.

import type { Goal, GoalEntry, GoalKind } from "@/db/schema";

export type GoalView = {
  id: number;
  title: string;
  groupLabel: string | null;
  kind: GoalKind;
  targetValue: number | null;
  unit: string | null;
  startDate: string;
  deadline: string;
  note: string | null;
  completedAt: string | null;
  sortOrder: number;
  // Beregnet:
  current: number; // count: sum af deltaer; level: nyeste måling; milestone: 0/1
  expected: number | null; // kurs-forventning i dag (null for milestone)
  done: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

// Lineær kurs: 0 ved start, targetValue ved deadline; clampet udenfor.
export function expectedByDate(
  goal: Pick<Goal, "startDate" | "deadline" | "targetValue">,
  dateIso: string,
): number | null {
  if (goal.targetValue === null) return null;
  const total = daysBetween(goal.startDate, goal.deadline);
  if (total <= 0) return goal.targetValue;
  const elapsed = daysBetween(goal.startDate, dateIso);
  const frac = Math.min(1, Math.max(0, elapsed / total));
  return Math.round(goal.targetValue * frac);
}

export function currentValue(
  goal: Pick<Goal, "kind" | "completedAt">,
  entries: Pick<GoalEntry, "date" | "value" | "id">[],
): number {
  if (goal.kind === "milestone") return goal.completedAt ? 1 : 0;
  if (goal.kind === "level") {
    // Nyeste måling gælder (dato, dernæst id ved samme dag).
    const latest = [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    );
    return latest.length > 0 ? latest[latest.length - 1].value : 0;
  }
  return entries.reduce((sum, e) => sum + e.value, 0);
}

export function toGoalView(
  goal: Goal,
  entries: Pick<GoalEntry, "date" | "value" | "id">[],
  todayIso: string,
): GoalView {
  const current = currentValue(goal, entries);
  const done =
    goal.kind === "milestone"
      ? goal.completedAt !== null
      : goal.targetValue !== null && current >= goal.targetValue;
  return {
    id: goal.id,
    title: goal.title,
    groupLabel: goal.groupLabel,
    kind: goal.kind as GoalKind,
    targetValue: goal.targetValue,
    unit: goal.unit,
    startDate: goal.startDate,
    deadline: goal.deadline,
    note: goal.note,
    completedAt: goal.completedAt,
    sortOrder: goal.sortOrder,
    current,
    expected: goal.kind === "milestone" ? null : expectedByDate(goal, todayIso),
    done,
  };
}
