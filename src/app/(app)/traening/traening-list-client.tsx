"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookmarkMinus,
  CalendarClock,
  Clock,
  Dumbbell,
  Plus,
  X,
} from "lucide-react";
import { createWorkout, deleteWorkoutTemplate } from "./actions";
import { danishLongDate, danishWeekday, todayIsoDate } from "@/lib/date";
import { PlanDialog, type PlanItemData } from "@/components/plan-dialog";
import { scheduleLabel } from "@/lib/plan";

type WorkoutRow = {
  id: number;
  title: string;
  date: string;
  durationMin: number | null;
  exerciseCount: number;
};

type TemplateRow = {
  id: number;
  title: string;
  durationMin: number | null;
  body: string;
  exerciseCount: number;
};

export function TraeningListClient({
  initialWorkouts,
  initialTemplates,
  plans,
}: {
  initialWorkouts: WorkoutRow[];
  initialTemplates: TemplateRow[];
  plans: PlanItemData[];
}) {
  const router = useRouter();
  const [workouts] = useState(initialWorkouts);
  const [templates, setTemplates] = useState(initialTemplates);
  // null = dialog lukket; undefined = tom session; ellers valgt skabelon.
  const [createFrom, setCreateFrom] = useState<TemplateRow | undefined | null>(
    null,
  );
  // null = lukket; undefined = opret ny plan; ellers redigér eksisterende.
  const [planEdit, setPlanEdit] = useState<PlanItemData | undefined | null>(
    null,
  );

  return (
    <div className="mx-auto max-w-[680px] px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-hair pb-5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Træning
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            {workouts.length === 0
              ? "Ingen sessioner endnu"
              : `${workouts.length} session${workouts.length === 1 ? "" : "er"}`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreateFrom(undefined)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Log træning
        </button>
      </header>

      {templates.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.6px] text-dim">
            Start fra skabelon
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center overflow-hidden rounded-[8px] bg-bg-elevated shadow-[var(--shadow-card)]"
              >
                <button
                  type="button"
                  onClick={() => setCreateFrom(t)}
                  title={`Ny session fra "${t.title}"`}
                  className="inline-flex cursor-pointer items-center gap-2 py-2 pl-3 pr-2 text-left hover:bg-bg-subtle"
                >
                  <span className="text-[13px] font-medium text-ink">
                    {t.title}
                  </span>
                  <span className="text-[11px] text-light">
                    {t.exerciseCount} øvelse{t.exerciseCount === 1 ? "" : "r"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Slet skabelonen "${t.title}"?`)) return;
                    await deleteWorkoutTemplate(t.id);
                    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
                  }}
                  title="Slet skabelon"
                  className="cursor-pointer self-stretch px-2 text-dim hover:bg-bg-subtle hover:text-danger"
                >
                  <BookmarkMinus className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.6px] text-dim">
          Planlagt træning
        </div>
        <div className="flex flex-wrap gap-2">
          {plans.map((pl) => {
            const templateTitle =
              pl.workoutTemplateId !== null
                ? templates.find((t) => t.id === pl.workoutTemplateId)?.title
                : undefined;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => setPlanEdit(pl)}
                title="Redigér planen"
                className={`inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-[8px] bg-bg-elevated px-3 py-2 text-left shadow-[var(--shadow-card)] hover:bg-bg-subtle ${
                  pl.paused ? "opacity-55" : ""
                }`}
              >
                <CalendarClock
                  className={`size-3.5 ${pl.paused ? "text-dim" : "text-accent"}`}
                />
                <span className="text-[13px] font-medium text-ink">
                  {templateTitle ?? pl.label ?? "Træning"}
                </span>
                <span className="text-[11px] text-light">
                  {pl.paused ? "på pause" : scheduleLabel(pl)}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPlanEdit(undefined)}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-[8px] border border-dashed border-hair-strong px-3 py-2 text-[12px] text-light hover:border-accent hover:text-accent"
          >
            <Plus className="size-3.5" />
            Planlæg træning
          </button>
        </div>
      </section>

      {workouts.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
          Log din første session — øvelser, sæt og noter i fri tekst.
        </div>
      ) : (
        <div className="space-y-2">
          {workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      )}

      {createFrom !== null && (
        <CreateDialog
          template={createFrom}
          onClose={() => setCreateFrom(null)}
        />
      )}

      {planEdit !== null && (
        <PlanDialog
          label="Planlægning"
          title={
            planEdit === undefined
              ? "Planlæg træning"
              : (planEdit.workoutTemplateId !== null
                  ? templates.find((t) => t.id === planEdit.workoutTemplateId)
                      ?.title
                  : undefined) ??
                planEdit.label ??
                "Træning"
          }
          kind="training"
          existing={planEdit ?? null}
          templates={templates.map((t) => ({ id: t.id, title: t.title }))}
          showLabel
          onChanged={() => router.refresh()}
          onClose={() => setPlanEdit(null)}
        />
      )}
    </div>
  );
}

function WorkoutCard({ workout }: { workout: WorkoutRow }) {
  return (
    <Link
      href={`/traening/${workout.id}`}
      className="flex items-center gap-3.5 rounded-[10px] bg-bg-elevated px-4 py-3.5 shadow-[var(--shadow-card)] transition-colors hover:bg-bg-subtle"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-bg)] text-accent">
        <Dumbbell className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-[16px] leading-tight text-ink">
          {workout.title}
        </div>
        <div className="mt-0.5 text-[12px] text-light">
          <span className="capitalize">{danishWeekday(workout.date)}</span>{" "}
          {danishLongDate(workout.date)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-light">
        {workout.exerciseCount > 0 && (
          <span>
            {workout.exerciseCount} øvelse{workout.exerciseCount === 1 ? "" : "r"}
          </span>
        )}
        {workout.durationMin !== null && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {workout.durationMin} min
          </span>
        )}
      </div>
    </Link>
  );
}

function CreateDialog({
  template,
  onClose,
}: {
  template: TemplateRow | undefined;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(template?.title ?? "");
  const [date, setDate] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t) {
      setError("Giv sessionen en titel");
      return;
    }
    setError(null);
    start(async () => {
      const res = await createWorkout({
        title: t,
        date,
        durationMin: template?.durationMin ?? null,
        body: template?.body ?? "",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Videre til detaljesiden hvor øvelserne udfyldes/justeres.
      router.push(`/traening/${res.workout.id}?rediger=1`);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="w-full max-w-[400px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              {template ? "Ny session fra skabelon" : "Log træning"}
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              {template ? template.title : "Hvad har du lavet?"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center rounded-[6px] p-1 text-dim hover:bg-bg hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="fx 'Pull + press' eller 'Løbetur'"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          className="!rounded-[8px] !border-hair !bg-bg-subtle"
        />
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Dato
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="!rounded-[8px] !border-hair !bg-bg-subtle"
          />
        </div>
        <p className="mt-2 text-[11px] italic text-light">
          {template
            ? "Programmet forudfyldes — justér de faktiske reps på næste side."
            : "Øvelser og noter tilføjes på næste side."}
        </p>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink disabled:opacity-50"
          >
            Annullér
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            {pending ? "Opretter…" : "Opret"}
          </button>
        </div>
      </div>
    </div>
  );
}
