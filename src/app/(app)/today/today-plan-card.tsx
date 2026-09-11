"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Apple,
  Check,
  CircleDashed,
  Dumbbell,
  FolderKanban,
  Pill,
  Undo2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  markPlanItem,
  markTrainedToday,
  startPlannedWorkout,
  unmarkPlanItem,
} from "./plan-actions";
import { logSupplementIntake } from "./supplement-actions";
import type { PlanKind } from "@/db/schema";

// Én post på Dagens plan — beregnet server-side i today/page.tsx.
export type TodayPlanEntry = {
  id: number;
  kind: PlanKind;
  title: string;
  timeOfDay: string | null;
  state: "open" | "done" | "skipped";
  supplementId: number | null;
  doseText: string | null;
  workoutTemplateId: number | null;
  minutesPlanned: number | null;
  minutesActual: number | null;
  targets: {
    kcal: number | null;
    carbs: number | null;
    protein: number | null;
    fat: number | null;
    fiber: number | null;
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
    if (e.kind === "supplement" && e.supplementId !== null) {
      run(e.id, () => logSupplementIntake({ supplementId: e.supplementId! }));
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
              className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 ${
                e.state === "skipped"
                  ? "opacity-45"
                  : e.state === "done"
                    ? "bg-bg-subtle/60"
                    : "bg-bg-subtle"
              }`}
            >
              {/* Status/handling */}
              {isInfo ? (
                <span className="inline-flex size-9 shrink-0 items-center justify-center text-light sm:size-7">
                  <Icon className="size-4" />
                </span>
              ) : e.state === "done" ? (
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] text-success sm:size-7">
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
              ) : autoChecked ? (
                <span className="inline-flex size-9 shrink-0 items-center justify-center text-dim sm:size-7">
                  <CircleDashed className="size-4" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPrimary(e)}
                  disabled={pending || e.state === "skipped"}
                  title={
                    e.kind === "supplement"
                      ? "Log indtag med standard-dosis"
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
                  {e.timeOfDay && <span>{e.timeOfDay}</span>}
                  {e.kind === "project" && e.minutesPlanned !== null && (
                    <span>
                      {e.timeOfDay ? " · " : ""}
                      {fmtMinutes(e.minutesActual ?? 0)} af{" "}
                      {fmtMinutes(e.minutesPlanned)}
                    </span>
                  )}
                  {e.kind === "nutrition" && e.targets && (
                    <span>
                      {[
                        e.targets.kcal !== null
                          ? `${e.actuals?.kcal ?? 0}/${e.targets.kcal} kcal`
                          : null,
                        e.targets.protein !== null
                          ? `${e.actuals?.protein ?? 0}/${e.targets.protein}P`
                          : null,
                        e.targets.carbs !== null
                          ? `${e.actuals?.carbs ?? 0}/${e.targets.carbs}K`
                          : null,
                        e.targets.fat !== null
                          ? `${e.actuals?.fat ?? 0}/${e.targets.fat}F`
                          : null,
                        e.targets.fiber !== null
                          ? `${e.actuals?.fiber ?? 0}/${e.targets.fiber} fibre`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Skip / fortryd */}
              {e.state === "skipped" ? (
                <button
                  type="button"
                  onClick={() => run(e.id, () => unmarkPlanItem(e.id, date))}
                  disabled={pending}
                  title="Fortryd 'ikke i dag'"
                  className="inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1 rounded-[6px] px-2 text-[11px] text-dim hover:text-ink disabled:opacity-50"
                >
                  <Undo2 className="size-3.5" />
                  Fortryd
                </button>
              ) : (
                e.state === "open" &&
                !isInfo && (
                  <button
                    type="button"
                    onClick={() => run(e.id, () => markPlanItem(e.id, date, "skip"))}
                    disabled={pending}
                    title="Ikke i dag (rører ikke rytmen)"
                    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:text-mid sm:size-7"
                  >
                    <X className="size-3.5" />
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
