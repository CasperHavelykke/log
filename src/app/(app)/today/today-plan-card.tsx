"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Apple,
  Check,
  ChevronsRight,
  CircleDashed,
  Dumbbell,
  FolderKanban,
  LogIn,
  Pill,
  Undo2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  checkInPlanItem,
  markPlanItem,
  markTrainedToday,
  postponePlanItem,
  startPlannedWorkout,
  undoCheckIn,
  undoPostponePlanItem,
  unmarkPlanItem,
} from "./plan-actions";
import { logSupplementIntake } from "./supplement-actions";
import { fmtDoseX100, nutritionRangeSatisfied } from "@/lib/plan";
import type { PlanKind } from "@/db/schema";

export type NutritionRange = { min: number | null; max: number | null };

// Én post på Dagens plan — beregnet server-side i today/page.tsx.
export type TodayPlanEntry = {
  id: number;
  kind: PlanKind;
  title: string;
  timeOfDay: string | null;
  state: "open" | "done" | "skipped" | "postponed";
  // Navne-binding: tilskud logges og matches på navn, ikke chip-id.
  supplementName: string | null;
  doseText: string | null;
  // Dosis-mål: dagens summerede indtag mod tilskuddets standard-dosis.
  doseProgress: {
    doneX100: number;
    targetX100: number;
    unit: string | null;
  } | null;
  workoutTemplateId: number | null;
  minutesPlanned: number | null;
  minutesActual: number | null;
  // Check-in: dagens faktiske starttidspunkt (kun projekt-poster).
  checkInAt: string | null;
  // Ernærings-mål som intervaller: min = "mindst", max = "højst".
  targets: {
    kcal: NutritionRange;
    carbs: NutritionRange;
    protein: NutritionRange;
    fat: NutritionRange;
    fiber: NutritionRange;
  } | null;
  actuals: {
    kcal: number | null;
    carbs: number | null;
    protein: number | null;
    fat: number | null;
    fiber: number | null;
  } | null;
};

const KIND_ICON: Record<PlanKind, typeof Pill> = {
  supplement: Pill,
  training: Dumbbell,
  project: FolderKanban,
  nutrition: Apple,
  meal: UtensilsCrossed,
};

// Interval-bjælker per makro: målzonen (min–maks) er et bånd på en tynd
// bjælke, dagens værdi en prik — så man med ét blik ser om man er under,
// i eller over zonen. Farve: grå = under minimum endnu, grøn = inden for,
// rav = over maksimum.
function NutritionBars({
  targets,
  actuals,
}: {
  targets: NonNullable<TodayPlanEntry["targets"]>;
  actuals: TodayPlanEntry["actuals"];
}) {
  const fields: { key: keyof typeof targets; label: string }[] = [
    { key: "kcal", label: "Kcal" },
    { key: "protein", label: "Protein" },
    { key: "carbs", label: "Kulhydrat" },
    { key: "fat", label: "Fedt" },
    { key: "fiber", label: "Fibre" },
  ];
  const rows = fields.flatMap(({ key, label }) => {
    const { min, max } = targets[key];
    if (min === null && max === null) return [];
    const actual = actuals?.[key] ?? null;
    const ok = nutritionRangeSatisfied(actual, min, max);
    const over = max !== null && actual !== null && actual > max;
    // Skala: 0 → lidt forbi det største af zone og værdi, så prikken
    // aldrig klistrer i kanten.
    const scaleEnd =
      Math.max(min ?? 0, max ?? 0, actual ?? 0, 1) * 1.15;
    const pct = (v: number) => Math.min(100, Math.max(0, (v / scaleEnd) * 100));
    return [
      {
        key,
        label,
        rangeText:
          min !== null && max !== null
            ? `${min}–${max}`
            : min !== null
              ? `≥${min}`
              : `≤${max}`,
        actual,
        zoneLeft: pct(min ?? 0),
        zoneWidth: pct(max ?? scaleEnd) - pct(min ?? 0),
        dotLeft: pct(actual ?? 0),
        textClass: over ? "text-warning" : ok ? "text-success" : "text-mid",
        dotClass: over ? "bg-warning" : ok ? "bg-success" : "bg-dim",
      },
    ];
  });
  if (rows.length === 0) return null;
  return (
    <div className="mt-1.5 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.key} className={r.key === "kcal" ? "sm:col-span-2" : ""}>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-light">{r.label}</span>
            <span className={`tabular-nums ${r.textClass}`}>
              {r.actual ?? 0} / {r.rangeText}
            </span>
          </div>
          <div className="relative mt-1 h-1.5 rounded-full bg-bg">
            <div
              className="absolute inset-y-0 rounded-full bg-hair-strong"
              style={{ left: `${r.zoneLeft}%`, width: `${r.zoneWidth}%` }}
            />
            <div
              className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${r.dotClass}`}
              style={{ left: `${r.dotLeft}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// timeOfDay parses lempeligt som mødetid: "9", "09", "kl 9", "kl. 9",
// "9:00", "9.30" virker alle (minutter udelades = :00). Fri tekst som
// "formiddag" giver null — så vises check-in bare uden farve.
function parseClock(t: string | null): number | null {
  if (!t) return null;
  const m = /^(?:kl\.?\s*)?([01]?\d|2[0-3])(?:[.:]([0-5]\d))?$/i.exec(
    t.trim(),
  );
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} t`;
  return `${h} t ${m} min`;
}

export function TodayPlanCard({
  date,
  entries,
}: {
  date: string;
  entries: TodayPlanEntry[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, start] = useTransition();

  if (entries.length === 0) return null;

  const openCount = entries.filter((e) => e.state === "open").length;
  const doneCount = entries.filter((e) => e.state === "done").length;

  function run(id: number, fn: () => Promise<unknown>) {
    setPendingId(id);
    start(async () => {
      await fn();
      setPendingId(null);
      router.refresh();
    });
  }

  function onPrimary(e: TodayPlanEntry) {
    if (e.kind === "supplement" && e.supplementName !== null) {
      // Logges på NAVN med planens mål-dosis — eller kun RESTEN op til
      // målet ved delvist indtag (6 af 12 g taget → klik logger 6 g).
      const dose =
        e.doseProgress !== null
          ? e.doseProgress.doneX100 > 0
            ? e.doseProgress.targetX100 - e.doseProgress.doneX100
            : e.doseProgress.targetX100
          : null;
      run(e.id, () =>
        logSupplementIntake({
          name: e.supplementName!,
          ...(dose !== null && dose > 0
            ? {
                doseAmountX100: dose,
                doseUnit: e.doseProgress!.unit,
              }
            : {}),
        }),
      );
    } else if (e.kind === "training") {
      if (e.workoutTemplateId !== null) {
        setPendingId(e.id);
        start(async () => {
          const res = await startPlannedWorkout(e.id);
          setPendingId(null);
          if (res.ok) {
            router.push(`/traening/${res.workoutId}?rediger=1`);
          } else {
            router.refresh();
          }
        });
      } else {
        run(e.id, () => markTrainedToday(date));
      }
    } else {
      // meal + projekt uden tidsmål: manuel afkrydsning.
      run(e.id, () => markPlanItem(e.id, date, "done"));
    }
  }

  return (
    <section className="mb-4 rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-3 flex items-baseline justify-between border-b border-hair pb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Dagens plan
        </span>
        <span className="text-[11px] text-light">
          {doneCount}/{doneCount + openCount} klaret
        </span>
      </div>

      <ul className="space-y-1.5">
        {entries.map((e) => {
          const Icon = KIND_ICON[e.kind];
          const pending = pendingId === e.id;
          const isInfo = e.kind === "nutrition";
          const autoChecked =
            e.kind === "project" && e.minutesPlanned !== null;

          return (
            <li
              key={e.id}
              className={`flex gap-2.5 rounded-[8px] px-2.5 py-2 ${
                e.kind === "nutrition" ? "items-start" : "items-center"
              } ${
                e.state === "skipped" || e.state === "postponed"
                  ? "opacity-45"
                  : e.state === "done"
                    ? "bg-bg-subtle/60"
                    : "bg-bg-subtle"
              }`}
            >
              {/* Status/handling — også ernæring viser kryds når alle mål
                  er inden for grænserne (auto-beregnet server-side). */}
              {e.state === "done" ? (
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] text-success sm:size-7">
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
              ) : isInfo ? (
                <span className="inline-flex size-9 shrink-0 items-center justify-center text-light sm:size-7">
                  <Icon className="size-4" />
                </span>
              ) : autoChecked ? (
                <span className="inline-flex size-9 shrink-0 items-center justify-center text-dim sm:size-7">
                  <CircleDashed className="size-4" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPrimary(e)}
                  disabled={
                    pending ||
                    e.state === "skipped" ||
                    e.state === "postponed"
                  }
                  title={
                    e.kind === "supplement"
                      ? e.doseProgress !== null && e.doseProgress.doneX100 > 0
                        ? `Log resten (${fmtDoseX100(e.doseProgress.targetX100 - e.doseProgress.doneX100)}${e.doseProgress.unit ? ` ${e.doseProgress.unit}` : ""})`
                        : "Log indtag med planens dosis"
                      : e.kind === "training"
                        ? e.workoutTemplateId !== null
                          ? "Start session fra skabelon"
                          : "Markér som trænet"
                        : "Markér som klaret"
                  }
                  className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-hair-strong text-dim transition hover:border-accent hover:text-accent disabled:opacity-50 sm:size-7"
                >
                  {pending ? (
                    <CircleDashed className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </button>
              )}

              {/* Tekst */}
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-[13px] ${
                    e.state === "done" ? "text-mid line-through" : "text-ink"
                  }`}
                >
                  {e.title}
                  {e.doseText && (
                    <span className="ml-1.5 text-[12px] text-light">
                      {e.doseText}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-light">
                  {e.state === "postponed" && (
                    <span className="mr-1.5 italic">udskudt til i morgen</span>
                  )}
                  {e.timeOfDay && <span>{e.timeOfDay}</span>}
                  {e.kind === "supplement" && e.doseProgress && (
                    <span>
                      {e.timeOfDay ? " · " : ""}
                      {fmtDoseX100(e.doseProgress.doneX100)} af{" "}
                      {fmtDoseX100(e.doseProgress.targetX100)}
                      {e.doseProgress.unit ? ` ${e.doseProgress.unit}` : ""}
                    </span>
                  )}
                  {e.kind === "project" && e.minutesPlanned !== null && (
                    <span>
                      {e.timeOfDay ? " · " : ""}
                      {fmtMinutes(e.minutesActual ?? 0)} af{" "}
                      {fmtMinutes(e.minutesPlanned)}
                    </span>
                  )}
                  {e.kind === "project" && e.checkInAt !== null && (() => {
                    const planned = parseClock(e.timeOfDay);
                    const d = new Date(e.checkInAt);
                    const actualMin = d.getHours() * 60 + d.getMinutes();
                    const late = planned !== null && actualMin > planned;
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          run(e.id, () => undoCheckIn(e.id, date))
                        }
                        disabled={pending}
                        title="Fortryd check-in"
                        className={`cursor-pointer hover:underline ${
                          planned === null
                            ? ""
                            : late
                              ? "text-warning"
                              : "text-success"
                        }`}
                      >
                        {" · "}mødt {fmtClock(e.checkInAt)}
                      </button>
                    );
                  })()}
                </div>
                {e.kind === "nutrition" && e.targets && (
                  <NutritionBars targets={e.targets} actuals={e.actuals} />
                )}
              </div>

              {/* Udsæt / skip / fortryd — ernæring har ingen handlinger */}
              {e.state === "skipped" || e.state === "postponed" ? (
                <button
                  type="button"
                  onClick={() =>
                    run(e.id, () =>
                      e.state === "postponed"
                        ? undoPostponePlanItem(e.id, date)
                        : unmarkPlanItem(e.id, date),
                    )
                  }
                  disabled={pending}
                  title={
                    e.state === "postponed"
                      ? "Fortryd udsættelsen"
                      : "Fortryd 'ikke i dag'"
                  }
                  className="inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1 rounded-[6px] px-2 text-[11px] text-dim hover:text-ink disabled:opacity-50"
                >
                  <Undo2 className="size-3.5" />
                  Fortryd
                </button>
              ) : (
                e.state === "open" &&
                !isInfo && (
                  <div className="flex shrink-0 items-center">
                    {e.kind === "project" &&
                      e.timeOfDay !== null &&
                      e.checkInAt === null && (
                        <button
                          type="button"
                          onClick={() =>
                            run(e.id, () => checkInPlanItem(e.id, date))
                          }
                          disabled={pending}
                          title="Tjek ind — registrér at du er i gang"
                          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:text-accent sm:size-7"
                        >
                          <LogIn className="size-3.5" />
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => run(e.id, () => postponePlanItem(e.id, date))}
                      disabled={pending}
                      title="Udsæt til i morgen (interval-rytme fortsætter derfra)"
                      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:text-mid sm:size-7"
                    >
                      <ChevronsRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => run(e.id, () => markPlanItem(e.id, date, "skip"))}
                      disabled={pending}
                      title="Ikke i dag (rører ikke rytmen)"
                      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:text-mid sm:size-7"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
