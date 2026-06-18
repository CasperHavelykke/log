"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { setFasteEnabled } from "@/lib/user-prefs";

export function FasteToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    start(async () => {
      await setFasteEnabled(next);
    });
  }

  return (
    <div className="mb-5 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-bg text-accent-bright">
          <Clock className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink">Faste-tracking</div>
          <div className="text-[12px] text-mid">
            Aktivér for at se faste-timer på /today og historik her
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition ${
            enabled ? "bg-accent" : "bg-bg"
          } border ${enabled ? "border-accent" : "border-border-light"}`}
          aria-pressed={enabled}
        >
          <span
            className={`absolute top-0.5 inline-block size-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
