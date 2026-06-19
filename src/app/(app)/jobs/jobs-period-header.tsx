"use client";

import Link from "next/link";
import { Briefcase, Check } from "lucide-react";
import { formatDanishDate } from "@/lib/date";

export type PeriodOption = {
  id: number;
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
};

export function JobsPeriodHeader({
  periods,
  selectedPeriodId,
  showingAll,
}: {
  periods: PeriodOption[];
  selectedPeriodId: number | null;
  showingAll: boolean;
}) {
  const selected = selectedPeriodId
    ? periods.find((p) => p.id === selectedPeriodId)
    : null;

  return (
    <div className="mb-6 rounded-md border border-border bg-card px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          <Briefcase
            className={`size-4 ${selected?.isActive ? "text-success" : "text-mid"}`}
          />
          {showingAll ? (
            <span className="font-medium text-ink">Alle ansøgninger</span>
          ) : selected ? (
            <span className="font-medium text-ink">
              {selected.name ||
                `Periode fra ${formatDanishDate(selected.startedAt)}`}
              {selected.isActive ? (
                <span className="ml-2 rounded-[3px] bg-[rgba(74,222,128,0.12)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.4px] text-success">
                  Aktiv
                </span>
              ) : null}
            </span>
          ) : (
            <span className="italic text-light">Ingen periode valgt</span>
          )}
          {selected && (
            <span className="text-[11px] text-light">
              · {formatDanishDate(selected.startedAt)} –{" "}
              {selected.endedAt
                ? formatDanishDate(selected.endedAt)
                : "i dag"}
            </span>
          )}
        </div>
      </div>

      {periods.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {periods.map((p) => {
            const active = !showingAll && selectedPeriodId === p.id;
            const href = `/jobs?period=${p.id}`;
            return (
              <Link
                key={p.id}
                href={href}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active
                    ? "border-accent bg-accent-bg text-accent-bright"
                    : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
                }`}
              >
                {active && <Check className="size-3" />}
                {p.name || formatDanishDate(p.startedAt)}
                {p.isActive && (
                  <span className="ml-0.5 text-[9px] text-success">●</span>
                )}
              </Link>
            );
          })}
          <Link
            href="/jobs?period=all"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
              showingAll
                ? "border-accent bg-accent-bg text-accent-bright"
                : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
            }`}
          >
            {showingAll && <Check className="size-3" />}
            Alle
          </Link>
        </div>
      )}

    </div>
  );
}
