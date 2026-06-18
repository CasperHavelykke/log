"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Check, Target } from "lucide-react";
import { setWeekGoal } from "@/app/(app)/today/actions";

type Field = "applications" | "focusHours";

export function WeekGoalCard({
  weekStart,
  field,
  label,
  initialTarget,
  otherTarget,
  existingText,
  unit,
  placeholder,
}: {
  weekStart: string;
  field: Field;
  label: string;
  initialTarget: number | null;
  otherTarget: number | null;
  existingText: string;
  unit: string;
  placeholder: string;
}) {
  const [targetInput, setTargetInput] = useState(
    initialTarget !== null ? formatTarget(initialTarget, field) : "",
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [, startSave] = useTransition();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveState("saving");
    const handle = setTimeout(() => {
      startSave(async () => {
        const parsedTarget = parseTarget(targetInput, field);
        await setWeekGoal({
          weekStart,
          text: existingText,
          applicationsTarget:
            field === "applications" ? parsedTarget : otherTarget,
          focusHoursTargetX10:
            field === "focusHours" ? parsedTarget : otherTarget,
        });
        setSaveState("saved");
      });
    }, 800);
    return () => clearTimeout(handle);
  }, [targetInput, weekStart, field, otherTarget, existingText]);

  return (
    <section className="rounded-md border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-mid">
          <Target className="size-4 text-accent-bright" />
          <span className="text-[13px]">{label}</span>
        </div>
        <div className="relative w-32">
          <input
            type="text"
            inputMode="decimal"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder={placeholder}
            className="!text-[14px]"
            style={{ paddingRight: "44px" }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-dim">
            {unit}
          </span>
        </div>
        <SaveIndicator state={saveState} />
      </div>
    </section>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] italic text-light">
        <Loader2 className="size-3 animate-spin" />
        Gemmer…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] italic text-success">
        <Check className="size-3" />
        Gemt
      </span>
    );
  }
  return null;
}

function formatTarget(value: number, field: Field): string {
  if (field === "applications") return String(value);
  return (value / 10).toString().replace(".", ",");
}

function parseTarget(s: string, field: Field): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  if (field === "applications") return Math.floor(n);
  return Math.round(n * 10);
}
