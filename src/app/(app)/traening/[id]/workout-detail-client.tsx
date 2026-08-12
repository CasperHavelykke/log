"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Clock,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteWorkout,
  saveWorkoutAsTemplate,
  updateWorkout,
} from "../actions";
import { danishLongDate, danishWeekday } from "@/lib/date";
import { parseWorkoutBody } from "@/lib/workout";

type WorkoutData = {
  id: number;
  title: string;
  date: string;
  durationMin: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export function WorkoutDetailClient({
  workout: initial,
  startInEdit,
}: {
  workout: WorkoutData;
  startInEdit: boolean;
}) {
  const router = useRouter();
  const [workout, setWorkout] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(startInEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [templateState, setTemplateState] = useState<
    "idle" | "saving" | "saved" | "updated"
  >("idle");

  function saveAsTemplate() {
    setTemplateState("saving");
    startSave(async () => {
      const res = await saveWorkoutAsTemplate(workout.id);
      if (!res.ok) {
        setTemplateState("idle");
        setError(res.error);
        return;
      }
      setTemplateState(res.updated ? "updated" : "saved");
      setTimeout(() => setTemplateState("idle"), 2500);
    });
  }

  function startEditing() {
    setDraft(workout);
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(workout);
    setError(null);
    setEditing(false);
  }

  function saveDraft() {
    setError(null);
    startSave(async () => {
      const res = await updateWorkout(workout.id, {
        title: draft.title,
        date: draft.date,
        durationMin: draft.durationMin,
        body: draft.body,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setWorkout({ ...draft, updatedAt: new Date().toISOString() });
      setEditing(false);
      router.refresh();
    });
  }

  async function onDelete() {
    if (!confirm(`Slet "${workout.title}"?`)) return;
    await deleteWorkout(workout.id);
    router.push("/traening");
  }

  const lines = parseWorkoutBody(workout.body);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <Link
          href="/traening"
          className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap text-[13px] text-mid hover:text-ink sm:min-h-0"
        >
          <ArrowLeft className="size-4" />
          Tilbage<span className="hidden sm:inline">&nbsp;til træning</span>
        </Link>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] text-mid hover:bg-bg-elevated hover:text-ink disabled:opacity-50"
              >
                <X className="size-3.5" />
                Annullér
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
              >
                <Check className="size-3.5" strokeWidth={2.5} />
                {saving ? "Gemmer…" : "Gem"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onDelete}
                title="Slet session"
                className="inline-flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] text-dim hover:bg-bg-elevated hover:text-danger sm:min-h-0 sm:min-w-0 sm:px-3"
              >
                <Trash2 className="size-4 sm:size-3.5" />
                <span className="hidden sm:inline">Slet</span>
              </button>
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={templateState === "saving"}
                title="Gem programmet som skabelon, så en ny session kan starte forudfyldt"
                className={`inline-flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-[12px] disabled:opacity-50 sm:min-h-0 sm:min-w-0 sm:px-3 ${
                  templateState === "saved" || templateState === "updated"
                    ? "text-success"
                    : "text-dim hover:bg-bg-elevated hover:text-ink"
                }`}
              >
                {templateState === "saved" || templateState === "updated" ? (
                  <Check className="size-4 sm:size-3.5" strokeWidth={2.5} />
                ) : (
                  <BookmarkPlus className="size-4 sm:size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {templateState === "saved"
                    ? "Gemt som skabelon"
                    : templateState === "updated"
                      ? "Skabelon opdateret"
                      : templateState === "saving"
                        ? "Gemmer…"
                        : "Gem som skabelon"}
                </span>
              </button>
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-bg-elevated px-3.5 py-1.5 text-[12px] text-mid hover:bg-bg-subtle hover:text-ink sm:min-h-0"
              >
                <Pencil className="size-3.5" />
                Rediger
              </button>
            </>
          )}
        </div>
      </div>

      <header className="mb-5 border-b border-hair pb-5">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
                Titel
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="!rounded-[8px] !border-hair !bg-bg-subtle"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* min-w-0 + w-full: iOS' dato-input har en indbygget
                  minimumsbredde og skubber ellers ind over nabofeltet
                  på smalle skærme (iPhone mini). */}
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
                  Dato
                </label>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="!w-full min-w-0 !rounded-[8px] !border-hair !bg-bg-subtle"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
                  Varighed (min)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.durationMin === null ? "" : String(draft.durationMin)}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setDraft({
                      ...draft,
                      durationMin: v === "" ? null : Number(v),
                    });
                  }}
                  placeholder="fx 40"
                  className="!w-full min-w-0 !rounded-[8px] !border-hair !bg-bg-subtle"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
              <span className="capitalize">{danishWeekday(workout.date)}</span>{" "}
              {danishLongDate(workout.date)}
              {workout.durationMin !== null && (
                <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal">
                  <Clock className="size-3" />
                  {workout.durationMin} min
                </span>
              )}
            </div>
            <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
              {workout.title}
            </h1>
          </>
        )}
      </header>

      <section className="rounded-[10px] bg-bg-elevated p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 border-b border-hair pb-2 font-serif text-[16px] text-accent">
          Session
        </h2>
        {editing ? (
          <>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={14}
              placeholder={
                "Én øvelse per linje, fx:\nChin-ups — 4×2 fra failure\nKB press, én arm — 4×6-8 @ 16 kg\nTil slut:\nDead hang — 2×40 sek\nFri tekst uden format bliver til noter."
              }
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[14px] !leading-relaxed"
            />
            <p className="mt-2 text-[11px] italic text-light">
              &quot;Navn — sæt×reps @ vægt&quot; genkendes som øvelse. Linjer
              der ender med kolon bliver overskrifter. Alt andet vises som
              noter.
            </p>
          </>
        ) : lines.length === 0 ? (
          <p className="text-[12px] italic text-light">
            Ingen øvelser noteret endnu.
          </p>
        ) : (
          <div className="space-y-1.5">
            {lines.map((line, i) => {
              if (line.type === "heading") {
                return (
                  <div
                    key={i}
                    className={`text-[10px] font-semibold uppercase tracking-[0.6px] text-light ${i > 0 ? "pt-3" : ""}`}
                  >
                    {line.text}
                  </div>
                );
              }
              if (line.type === "exercise") {
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-baseline gap-x-2 rounded-[8px] bg-bg-subtle px-3 py-2"
                  >
                    <span className="text-[13px] font-medium text-ink">
                      {line.name}
                    </span>
                    <span className="text-[13px] text-mid">{line.detail}</span>
                  </div>
                );
              }
              return (
                <p key={i} className="px-1 py-0.5 text-[12px] italic text-mid">
                  {line.text}
                </p>
              );
            })}
          </div>
        )}
        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      </section>

      <div className="mt-4 text-right text-[11px] italic text-light">
        Oprettet {danishLongDate(workout.createdAt.slice(0, 10))}
        {workout.updatedAt.slice(0, 10) !== workout.createdAt.slice(0, 10) && (
          <> · Redigeret {danishLongDate(workout.updatedAt.slice(0, 10))}</>
        )}
      </div>
    </div>
  );
}
