"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatDanishDate } from "@/lib/date";

type Entry = {
  date: string;
  workNotes: string;
  dayNotes: string;
  wentWell: string;
  nextStep: string;
  healthNotes: string;
  mood: number | null;
  energy: number | null;
};

const SECTIONS: { key: keyof Entry; label: string }[] = [
  { key: "workNotes", label: "Arbejdsnoter" },
  { key: "wentWell", label: "Gik godt" },
  { key: "nextStep", label: "Næste skridt" },
  { key: "healthNotes", label: "Helbred" },
  { key: "dayNotes", label: "Dagsnoter" },
];

export function JournalPage({ entries }: { entries: Entry[] }) {
  const [search, setSearch] = useState("");

  const years = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.slice(0, 4)));
    return [...set].sort().reverse();
  }, [entries]);
  const [year, setYear] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (year !== "all" && !e.date.startsWith(year)) return false;
      if (!q) return true;
      return (
        e.workNotes.toLowerCase().includes(q) ||
        e.dayNotes.toLowerCase().includes(q) ||
        e.wentWell.toLowerCase().includes(q) ||
        e.nextStep.toLowerCase().includes(q) ||
        e.healthNotes.toLowerCase().includes(q) ||
        formatDanishDate(e.date).toLowerCase().includes(q)
      );
    });
  }, [entries, search, year]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8">
      <header className="mb-5 border-b border-hair pb-5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
          Journal
        </div>
        <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
          {entries.length === 0
            ? "Ingen notater endnu"
            : `${entries.length} dag${entries.length === 1 ? "" : "e"} med notater`}
        </h1>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-bg-elevated px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
        <Search className="size-4 text-light" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg i dine notater…"
          className="!w-full !rounded-none !border-0 !bg-transparent !p-0 !text-[14px]"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="inline-flex cursor-pointer items-center rounded-[6px] p-1 text-dim hover:bg-bg hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {years.length > 1 && (
        <div className="mb-5 inline-flex shrink-0 gap-0.5 rounded-[8px] bg-bg p-0.5">
          <YearChip active={year === "all"} onClick={() => setYear("all")} label="Alle" />
          {years.map((y) => (
            <YearChip
              key={y}
              active={year === y}
              onClick={() => setYear(y)}
              label={y}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong p-8 text-center text-sm italic text-dim">
          {entries.length === 0
            ? "Skriv dine første dagsnotater på I dag-siden."
            : "Ingen notater matcher din søgning."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <JournalCard key={e.date} entry={e} highlight={search.trim()} />
          ))}
        </div>
      )}
    </div>
  );
}

function YearChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[6px] px-3 py-1 text-[12px] transition-colors ${
        active ? "bg-accent text-white" : "text-mid hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function JournalCard({ entry, highlight }: { entry: Entry; highlight: string }) {
  return (
    <article className="rounded-[10px] bg-bg-elevated p-4 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hair pb-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            {entry.date.slice(0, 4)}
          </div>
          <h2 className="mt-0.5 font-serif text-[18px] leading-none text-ink">
            {formatDanishDate(entry.date)}
          </h2>
        </div>
        <div className="flex shrink-0 gap-1.5 text-[11px] text-light">
          {entry.mood !== null && (
            <span className="rounded-full bg-bg-subtle px-2 py-0.5">
              Humør {entry.mood}/5
            </span>
          )}
          {entry.energy !== null && (
            <span className="rounded-full bg-bg-subtle px-2 py-0.5">
              Energi {entry.energy}/5
            </span>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {SECTIONS.map((s) => {
          const text = entry[s.key] as string;
          if (!text) return null;
          return (
            <div key={s.key}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
                {s.label}
              </div>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                {highlight ? <Highlighted text={text} query={highlight} /> : text}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded bg-[var(--accent-bg)] text-ink">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
}
