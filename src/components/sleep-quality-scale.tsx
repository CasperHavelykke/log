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
            className={`box-border flex min-h-[44px] flex-col items-center justify-center rounded-[8px] border px-1.5 py-1 text-[12px] font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-70 md:min-h-[36px] md:rounded-[6px] ${
              active
                ? "border-accent bg-accent text-white"
                : "border-hair bg-bg-elevated text-mid hover:text-ink md:border-transparent md:bg-bg-subtle md:hover:bg-bg"
            } ${!disabled && "cursor-pointer"}`}
          >
            <span
              className={`text-[9px] uppercase tracking-[0.4px] ${active ? "opacity-70" : "text-light"}`}
            >
              {n}
            </span>
            <span className="leading-tight">{SLEEP_QUALITY_LABELS[n - 1]}</span>
          </button>
        );
      })}
    </div>
  );
}
