"use client";

import { useMemo, useState } from "react";
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
    <div className="mx-auto max-w-[760px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-serif text-[36px] font-medium leading-none text-ink">
            Journal
          </h1>
          <p className="mt-1 font-serif text-sm italic text-mid">
            {entries.length === 0
              ? "Ingen notater endnu"
              : `${entries.length} dag${entries.length === 1 ? "" : "e"} med notater`}
          </p>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg i dine notater..."
          className="!min-w-[240px] flex-1"
        />
        {years.length > 1 && (
          <div className="flex flex-wrap gap-1">
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
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm italic text-dim">
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
      className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] transition ${
        active
          ? "border-accent bg-accent text-white"
          : "border-border bg-card text-mid hover:border-accent-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function JournalCard({ entry, highlight }: { entry: Entry; highlight: string }) {
  return (
    <article className="rounded-md border border-border bg-card px-6 py-5 transition-colors hover:border-accent-dim">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-border-light pb-2.5">
        <h2 className="font-serif text-[19px] text-accent-bright">
          {formatDanishDate(entry.date)}
        </h2>
        <div className="flex gap-2 text-[11px] uppercase tracking-[0.3px] text-light">
          {entry.mood !== null && <span>Humør {entry.mood}/5</span>}
          {entry.energy !== null && <span>Energi {entry.energy}/5</span>}
        </div>
      </div>
      <div className="space-y-3">
        {SECTIONS.map((s) => {
          const text = entry[s.key] as string;
          if (!text) return null;
          return (
            <div key={s.key}>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.5px] text-light">
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
      <mark key={key++} className="rounded bg-accent/30 text-ink">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
}
