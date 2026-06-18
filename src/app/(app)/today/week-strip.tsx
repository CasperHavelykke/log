"use client";

import Link from "next/link";

export function WeekStrip({
  appsThisWeek,
  weekHoursX10,
  applicationsTarget,
  focusHoursTargetX10,
}: {
  appsThisWeek: number;
  weekHoursX10: number;
  applicationsTarget: number | null;
  focusHoursTargetX10: number | null;
}) {
  const hasAppGoal = applicationsTarget !== null && applicationsTarget > 0;
  const hasFocusGoal =
    focusHoursTargetX10 !== null && focusHoursTargetX10 > 0;

  if (!hasAppGoal && !hasFocusGoal) {
    return (
      <p className="mb-4 text-center text-[12px] italic text-light">
        Ingen ugemål sat —{" "}
        <Link href="/jobs" className="underline hover:text-accent-bright">
          sæt ét på /jobs
        </Link>{" "}
        eller{" "}
        <Link href="/projects" className="underline hover:text-accent-bright">
          /projekter
        </Link>
      </p>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      {hasAppGoal && (
        <ProgressLink
          href="/jobs"
          value={appsThisWeek}
          target={applicationsTarget}
          label="ansøgninger"
        />
      )}
      {hasFocusGoal && (
        <ProgressLink
          href="/projects"
          value={weekHoursX10 / 10}
          target={focusHoursTargetX10 / 10}
          label="t fokus"
          decimals={1}
        />
      )}
    </div>
  );
}

function ProgressLink({
  href,
  value,
  target,
  label,
  decimals = 0,
}: {
  href: string;
  value: number;
  target: number;
  label: string;
  decimals?: number;
}) {
  const pct = Math.min(100, (value / target) * 100);
  const reached = value >= target;
  const fmt = (n: number) =>
    decimals === 0 ? String(Math.round(n)) : n.toFixed(decimals).replace(".", ",");
  return (
    <Link
      href={href}
      className="group min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2.5 transition hover:border-accent-bright"
    >
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-mid">{label}</span>
        <span
          className={`font-medium ${reached ? "text-success" : "text-ink"}`}
        >
          {fmt(value)} / {fmt(target)}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-success" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}
