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
    <section className="rounded-md border border-border bg-card px-5 py-5">
      <div className="mb-4 flex items-baseline justify-between border-b border-border-light pb-3">
        <h2 className="font-serif text-[20px] font-medium text-accent-bright">
          Dagens refleksion
        </h2>
        <SaveIndicator state={saveState} savedAt={savedAt} />
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-mid">
            Arbejdsnoter
            <span className="ml-1 text-[11px] italic text-dim">— valgfri</span>
          </label>
          <textarea
            value={workNotes}
            onChange={(e) => setWorkNotes(e.target.value)}
            rows={3}
            placeholder="Hvad arbejdede du med? Detaljer, beslutninger, frustrationer."
            className="!text-[14px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-mid">
              Gik godt
            </label>
            <textarea
              value={wentWell}
              onChange={(e) => setWentWell(e.target.value)}
              rows={3}
              placeholder="Selv små ting tæller."
              className="!text-[14px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-mid">
              Næste skridt
            </label>
            <textarea
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              rows={3}
              placeholder="Hvad starter du med i morgen?"
              className="!text-[14px]"
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
