"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { saveReflection } from "./reflection-actions";

export function ReflectionCard({
  date,
  initialWorkNotes,
  initialWentWell,
  initialNextStep,
}: {
  date: string;
  initialWorkNotes: string;
  initialWentWell: string;
  initialNextStep: string;
}) {
  const [workNotes, setWorkNotes] = useState(initialWorkNotes);
  const [wentWell, setWentWell] = useState(initialWentWell);
  const [nextStep, setNextStep] = useState(initialNextStep);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const isFirstRender = useRef(true);
  const [, startSave] = useTransition();

  // Auto-save på 800ms debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveState("saving");
    const handle = setTimeout(() => {
      startSave(async () => {
        const res = await saveReflection({
          date,
          workNotes: workNotes || null,
          wentWell: wentWell || null,
          nextStep: nextStep || null,
        });
        if (res.ok) {
          setSaveState("saved");
          setSavedAt(new Date());
        }
      });
    }, 800);
    return () => clearTimeout(handle);
  }, [workNotes, wentWell, nextStep, date]);

  return (
    <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-hair pb-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Dagens refleksion
          </div>
          <h2 className="mt-0.5 font-serif text-[18px] leading-none text-ink">
            Hvordan gik i dag?
          </h2>
        </div>
        <SaveIndicator state={saveState} savedAt={savedAt} />
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Arbejdsnoter
            <span className="ml-1 normal-case tracking-normal text-dim">— valgfri</span>
          </label>
          <textarea
            value={workNotes}
            onChange={(e) => setWorkNotes(e.target.value)}
            rows={3}
            placeholder="Hvad arbejdede du med? Detaljer, beslutninger, frustrationer."
            className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[14px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Gik godt
            </label>
            <textarea
              value={wentWell}
              onChange={(e) => setWentWell(e.target.value)}
              rows={3}
              placeholder="Selv små ting tæller."
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[14px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Næste skridt
            </label>
            <textarea
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              rows={3}
              placeholder="Hvad starter du med i morgen?"
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[14px]"
            />
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] italic text-dim">
        <Pencil className="size-3" />
        Auto-gemmes mens du skriver
      </p>
    </section>
  );
}

function SaveIndicator({
  state,
  savedAt,
}: {
  state: "idle" | "saving" | "saved";
  savedAt: Date | null;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] italic text-light">
        <Loader2 className="size-3 animate-spin" />
        Gemmer…
      </span>
    );
  }
  if (state === "saved" && savedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] italic text-success">
        <Check className="size-3" />
        Gemt {pad(savedAt.getHours())}:{pad(savedAt.getMinutes())}
      </span>
    );
  }
  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
