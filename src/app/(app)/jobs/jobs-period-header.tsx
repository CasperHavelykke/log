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

const STATUS_ORDER: { key: string; label: string; tone?: string }[] = [
  { key: "sent", label: "Sendt" },
  { key: "no_response", label: "Intet svar", tone: "text-warning" },
  { key: "replied", label: "Svar", tone: "text-accent-bright" },
  { key: "interview", label: "Interview", tone: "text-accent-bright" },
  { key: "offer", label: "Tilbud", tone: "text-success" },
  { key: "rejected", label: "Afvist", tone: "text-danger" },
  { key: "withdrawn", label: "Trukket" },
];

export function JobsPeriodHeader({
  periods,
  selectedPeriodId,
  showingAll,
  totalCount,
  statusCounts,
}: {
  periods: PeriodOption[];
  selectedPeriodId: number | null;
  showingAll: boolean;
  totalCount: number;
  statusCounts: Record<string, number>;
}) {
  const selected = selectedPeriodId
    ? periods.find((p) => p.id === selectedPeriodId)
    : null;

  return (
    <div className="mb-6 rounded-md border border-border bg-card px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
        <div className="mb-3 flex flex-wrap gap-1">
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

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border-light pt-3 text-[12px]">
        <StatCount label="I alt" value={totalCount} tone="text-ink" />
        {STATUS_ORDER.map((s) => (
          <StatCount
            key={s.key}
            label={s.label}
            value={statusCounts[s.key] ?? 0}
            tone={s.tone}
          />
        ))}
      </div>
    </div>
  );
}

function StatCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`font-medium ${tone ?? "text-ink"}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-[0.3px] text-light">
        {label}
      </span>
    </span>
  );
}
