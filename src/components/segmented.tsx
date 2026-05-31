"use client";

type Option<T extends string | number> = { value: T; label: string; hint?: string };

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  clearable = true,
  className = "",
}: {
  value: T | null;
  onChange: (v: T | null) => void;
  options: Option<T>[];
  clearable?: boolean;
  className?: string;
}) {
  return (
    <div className={`inline-flex flex-wrap gap-1 ${className}`}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(clearable && selected ? null : opt.value)}
            title={opt.hint}
            className={`min-w-9 rounded-md border px-2.5 py-1.5 text-sm transition ${
              selected
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-card text-foreground hover:border-accent/50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
