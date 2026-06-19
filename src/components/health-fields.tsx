"use client";

import type React from "react";

export function Section({
  icon,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 md:mb-0">
      <div className="mb-2 flex items-center gap-1.5 border-b border-hair pb-1.5 text-[10px] uppercase tracking-[0.6px] text-light md:mb-3">
        <span className="text-mid">{icon}</span>
        <span className="font-semibold">{title}</span>
        {meta && (
          <span className="ml-auto text-[10px] font-normal text-accent">
            {meta}
          </span>
        )}
      </div>
      <div className="space-y-4 sm:space-y-1">{children}</div>
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
      className={`flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${indent ? "sm:ml-3" : ""}`}
    >
      <span className="text-[14px] text-ink sm:text-[13px]">
        {label}
        {hint && (
          <span className="ml-1.5 rounded-[2px] bg-accent-bg px-1 py-0.5 text-[9px] uppercase tracking-[0.3px] text-accent-bright">
            {hint}
          </span>
        )}
      </span>
      <div className="self-stretch sm:self-auto">{children}</div>
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
    <div className="grid grid-cols-5 gap-1.5 sm:flex sm:gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? null : n)}
            className={`min-h-[44px] cursor-pointer rounded-[6px] border text-[15px] font-medium transition sm:min-h-[28px] sm:min-w-[28px] sm:rounded-[3px] sm:text-[11px] sm:font-normal ${
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
    <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-0.5">
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
            className={`min-h-[44px] cursor-pointer rounded-[6px] border px-3 text-[15px] font-medium transition sm:min-h-[28px] sm:min-w-[44px] sm:rounded-[3px] sm:px-2 sm:text-[11px] sm:font-normal ${
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
    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-0.5">
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
            className={`min-h-[44px] cursor-pointer rounded-[6px] border px-3 text-[14px] font-medium transition sm:min-h-[28px] sm:rounded-[3px] sm:px-2 sm:text-[11px] sm:font-normal ${
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
  fluid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder: string;
  fluid?: boolean;
}) {
  return (
    <div className={fluid ? "relative w-full" : "relative w-full sm:w-[110px]"}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="!text-[16px] sm:!text-[12px]"
        style={{ paddingRight: "40px" }}
      />
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-dim sm:text-[10px]"
      >
        {unit}
      </span>
    </div>
  );
}

export function CompactField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-[0.5px] text-light">
        {label}
        {hint && (
          <span className="ml-1 text-[10px] text-accent">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
