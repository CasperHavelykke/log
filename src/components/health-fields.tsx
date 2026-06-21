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
      <span className="text-[14px] text-ink sm:text-[13px] sm:text-mid">
        {label}
        {hint && (
          <span className="ml-1.5 rounded-[3px] bg-[var(--accent-bg)] px-1 py-0.5 text-[9px] uppercase tracking-[0.3px] text-accent">
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
    <div className="grid grid-cols-5 gap-1 sm:inline-flex sm:gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? null : n)}
            className={`box-border inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded-[8px] border text-[13px] font-medium outline-none transition-colors sm:min-w-[36px] md:min-h-[28px] md:min-w-[28px] md:rounded-[6px] md:text-[12px] ${
              active
                ? "border-accent bg-accent text-white"
                : "border-hair bg-bg-elevated text-mid hover:text-ink md:border-transparent md:bg-bg-subtle md:hover:bg-bg"
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
    <div className="grid grid-cols-2 gap-1 sm:inline-flex sm:gap-1">
      {[
        { label: "Ja", v: true },
        { label: "Nej", v: false },
      ].map(({ label, v }) => {
        const active = value === v;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(v)}
            className={`box-border inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded-[8px] border px-3 text-[13px] font-medium outline-none transition-colors sm:min-w-[52px] md:min-h-0 md:min-w-0 md:rounded-[4px] md:px-3 md:py-1 md:text-[12px] ${
              active
                ? "border-accent bg-accent text-white"
                : "border-hair bg-bg-elevated text-mid hover:text-ink md:border-transparent md:bg-bg-subtle md:hover:bg-bg"
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
    <div className="grid grid-cols-3 gap-1 sm:inline-flex sm:gap-1">
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
            className={`box-border inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded-[8px] border px-3 text-[13px] font-medium outline-none transition-colors md:min-h-0 md:rounded-[4px] md:px-3 md:py-1 md:text-[12px] ${
              active
                ? "border-accent bg-accent text-white"
                : "border-hair bg-bg-elevated text-mid hover:text-ink md:border-transparent md:bg-bg-subtle md:hover:bg-bg"
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
        className="!rounded-[8px] !border-hair !bg-bg-elevated !py-2 !text-[16px] md:!rounded-[6px] md:!border-transparent md:!bg-bg-subtle md:!py-1.5 md:!text-[13px]"
        style={{ paddingRight: "32px" }}
      />
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-light"
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
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        {label}
        {hint && (
          <span className="ml-1 text-[10px] text-accent">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
