"use client";

import type React from "react";

export function Section({
  icon,
  title,
  meta,
  aiPill,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  aiPill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.5px] text-light">
        <span className="text-mid">{icon}</span>
        <span>{title}</span>
        {aiPill && (
          <span className="ml-auto rounded-full bg-accent-bg px-1.5 py-0.5 text-[8px] tracking-[0.3px] text-accent-bright">
            AI
          </span>
        )}
        {meta && (
          <span className="ml-auto text-[10px] text-accent-bright">{meta}</span>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  indent,
  children,
}: {
  label: string;
  hint?: string;
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1 ${indent ? "ml-3" : ""}`}
    >
      <span className="text-[13px] text-ink">
        {label}
        {hint && (
          <span className="ml-1.5 rounded-[2px] bg-accent-bg px-1 py-0.5 text-[9px] uppercase tracking-[0.3px] text-accent-bright">
            {hint}
          </span>
        )}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Scale1to5({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? null : n)}
            className={`min-h-[28px] min-w-[28px] cursor-pointer rounded-[3px] border text-[11px] transition ${
              active
                ? "border-accent bg-accent-bg text-accent-bright"
                : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function YesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[
        { label: "Ja", v: true, cls: "yes" as const },
        { label: "Nej", v: false, cls: "no" as const },
      ].map(({ label, v, cls }) => {
        const active = value === v;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(v)}
            className={`min-h-[28px] min-w-[44px] cursor-pointer rounded-[3px] border px-2 text-[11px] transition ${
              active
                ? cls === "yes"
                  ? "border-success bg-[rgba(74,222,128,0.12)] text-success"
                  : "border-mid text-ink"
                : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function IntensityPicker({
  value,
  onChange,
}: {
  value: "light" | "medium" | "hard" | null;
  onChange: (v: "light" | "medium" | "hard" | null) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {(
        [
          { v: "light", label: "Let" },
          { v: "medium", label: "Mellem" },
          { v: "hard", label: "Hård" },
        ] as const
      ).map(({ v, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(active ? null : v)}
            className={`min-h-[28px] cursor-pointer rounded-[3px] border px-2 text-[11px] transition ${
              active
                ? "border-accent bg-accent-bg text-accent-bright"
                : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function CompactNumberInput({
  value,
  onChange,
  unit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder: string;
}) {
  return (
    <div className="relative w-[110px]">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="!text-[12px]"
        style={{ paddingRight: "32px", paddingTop: "5px", paddingBottom: "5px" }}
      />
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-dim"
      >
        {unit}
      </span>
    </div>
  );
}
