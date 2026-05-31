"use client";

import { SLEEP_QUALITY_LABELS } from "@/lib/sleep";

/**
 * 4-trins kvalitetsskala matchende Garmins inddeling:
 *   1 Dårlig   <60
 *   2 Rimelig  60-79
 *   3 God      80-89
 *   4 Fremragende ≥90
 */
export function SleepQualityScale({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {[1, 2, 3, 4].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? null : n)}
            className={`flex flex-col items-center justify-center rounded-[3px] border px-1.5 py-1.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${
              active
                ? "border-accent bg-accent text-white"
                : "border-border bg-bg text-mid hover:border-accent-dim hover:text-ink"
            } ${!disabled && "cursor-pointer"}`}
          >
            <span
              className={`text-[10px] ${active ? "opacity-80" : "text-dim"}`}
            >
              {n}
            </span>
            <span>{SLEEP_QUALITY_LABELS[n - 1]}</span>
          </button>
        );
      })}
    </div>
  );
}
