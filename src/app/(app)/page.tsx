import Link from "next/link";
import { requireUser } from "@/lib/session";
import { and, between, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  getActiveProjects,
  getAllJobApplications,
  getDayEntriesInRange,
  getDayEntry,
  getTimeEntriesInRange,
  getWeekGoal,
} from "@/lib/queries";
import { effectiveSleepHoursX10 } from "@/lib/sleep";
import {
  danishLongDate,
  danishWeekday,
  formatDanishDate,
  mondayOf,
  toIsoDate,
  todayIsoDate,
} from "@/lib/date";

export const metadata = { title: "Overblik | Log" };

type Status =
  | "sent"
  | "no_response"
  | "replied"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

const STATUS_LABELS: Record<Status, string> = {
  sent: "Sendt",
  no_response: "Intet svar",
  replied: "Svar",
  interview: "Samtale",
  offer: "Tilbud",
  rejected: "Afvist",
  withdrawn: "Trukket",
};
const STATUS_CLASSES: Record<Status, string> = {
  sent: "bg-[rgba(74,144,226,0.15)] text-[var(--accent-bright)]",
  no_response: "bg-[rgba(160,174,192,0.15)] text-[var(--mid)]",
  replied: "bg-[rgba(251,191,36,0.15)] text-[var(--warning)]",
  interview: "bg-[rgba(74,222,128,0.15)] text-[var(--success)]",
  offer: "bg-[rgba(74,222,128,0.25)] text-[var(--success)]",
  rejected: "bg-[rgba(248,113,113,0.15)] text-[var(--danger)]",
  withdrawn: "bg-[rgba(160,174,192,0.15)] text-[var(--mid)]",
};

function fmtHours(x10: number): string {
  return (x10 / 10).toString().replace(".", ",");
}
function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

export default async function Dashboard() {
  const user = await requireUser();
  const today = todayIsoDate();
  const now = new Date();
  const weekStart = mondayOf(now);
  const weekEnd = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - ((now.getDay() || 7)))));
  const sevenAgo = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));

  const [weekGoal, todayEntry, weekDays, weekTime, projects, allApps, weekSleep] =
    await Promise.all([
      getWeekGoal(user.id, weekStart),
      getDayEntry(user.id, today),
      getDayEntriesInRange(user.id, sevenAgo, today),
      getTimeEntriesInRange(user.id, weekStart, weekEnd),
      getActiveProjects(user.id),
      getAllJobApplications(user.id),
      db
        .select()
        .from(schema.sleepEntries)
        .where(
          and(
            eq(schema.sleepEntries.userId, user.id),
            between(schema.sleepEntries.date, sevenAgo, today),
          ),
        ),
    ]);
  const sleepByDate = new Map(weekSleep.map((s) => [s.date, s]));

  // --- week hours per project ---
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const hoursByProject = new Map<number, number>();
  for (const t of weekTime) {
    hoursByProject.set(t.projectId, (hoursByProject.get(t.projectId) ?? 0) + t.hoursX10);
  }
  const projectHours = [...hoursByProject.entries()]
    .map(([id, x10]) => ({ name: projectName.get(id) ?? "Ukendt", x10 }))
    .sort((a, b) => b.x10 - a.x10);
  const weekTotalX10 = projectHours.reduce((s, p) => s + p.x10, 0);
  const maxProjectX10 = Math.max(1, ...projectHours.map((p) => p.x10));

  // --- health 7 days ---
  const byDate = new Map(weekDays.map((d) => [d.date, d]));
  const last7: { date: string; entry: (typeof weekDays)[number] | undefined }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    last7.push({ date: d, entry: byDate.get(d) });
  }
  // Effective sleep: Garmin's measured duration wins; otherwise the manual value.
  const allDatesForSleep = new Set<string>();
  for (const d of weekDays) allDatesForSleep.add(d.date);
  for (const s of weekSleep) allDatesForSleep.add(s.date);
  const effectiveSleepHoursList: number[] = [];
  for (const date of allDatesForSleep) {
    const manual = byDate.get(date)?.sleepHours ?? null;
    const garmin = sleepByDate.get(date)?.durationMin ?? null;
    const eff = effectiveSleepHoursX10(manual, garmin);
    if (eff !== null) effectiveSleepHoursList.push(eff / 10);
  }
  const avgSleep = avg(effectiveSleepHoursList);
  const avgMood = avg(weekDays.filter((d) => d.mood !== null).map((d) => d.mood!));
  const avgEnergy = avg(
    weekDays.filter((d) => d.energy !== null).map((d) => d.energy!),
  );

  // --- jobs ---
  const sentThisWeek = allApps.filter(
    (a) => a.sentAt && a.sentAt >= weekStart && a.sentAt <= weekEnd,
  ).length;
  const recentApps = allApps.slice(0, 5);

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <h1 className="font-serif text-[36px] font-medium leading-none text-ink">
          Overblik
        </h1>
        <div className="text-right">
          <div className="text-sm font-medium uppercase tracking-[1px] text-accent-bright">
            {danishWeekday(today)}
          </div>
          <div className="font-serif text-[20px] text-ink">{formatDanishDate(today)}</div>
        </div>
      </header>

      {/* Ugemål */}
      <Link
        href="/today"
        className="mb-6 flex items-center gap-4 rounded border border-[var(--accent-dim)] border-l-[3px] border-l-accent bg-gradient-to-br from-accent-bg to-transparent px-5 py-4 transition hover:border-accent"
      >
        <span className="whitespace-nowrap font-serif text-sm italic text-accent-bright">
          Mål for ugen:
        </span>
        <span className={weekGoal?.text ? "text-sm text-ink" : "text-sm italic text-light"}>
          {weekGoal?.text || "Intet mål sat — klik for at tilføje"}
        </span>
      </Link>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* I dag */}
        <Card title="I dag" href="/today">
          {todayEntry ? (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
              <Metric label="Humør" value={todayEntry.mood ? `${todayEntry.mood}/5` : "–"} />
              <Metric label="Energi" value={todayEntry.energy ? `${todayEntry.energy}/5` : "–"} />
              <Metric
                label="Søvn"
                value={todayEntry.sleepHours ? `${fmtHours(todayEntry.sleepHours)} t` : "–"}
              />
            </div>
          ) : (
            <p className="text-[13px] italic text-light">
              Du har ikke logget i dag endnu — klik for at åbne dagens log.
            </p>
          )}
        </Card>

        {/* Helbred 7 dage */}
        <Card title="Helbred · 7 dage" href="/health">
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
            <Metric label="Søvn Ø" value={avgSleep !== null ? `${fmtHours(avgSleep * 10)} t` : "–"} />
            <Metric label="Humør Ø" value={avgMood !== null ? `${avgMood}` : "–"} />
            <Metric label="Energi Ø" value={avgEnergy !== null ? `${avgEnergy}` : "–"} />
          </div>
          <div className="flex gap-1">
            {last7.map(({ date, entry }) => {
              const dot = !entry
                ? "bg-border"
                : entry.mood !== null && entry.mood <= 2
                  ? "bg-danger"
                  : "bg-success";
              return (
                <div key={date} className="flex flex-1 flex-col items-center gap-1">
                  <div className={`h-1.5 w-full rounded-full ${dot}`} />
                  <span className="text-[10px] text-dim">
                    {danishWeekday(date).slice(0, 1).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Denne uge - projekter */}
        <Card title="Denne uge · tid" href="/projects">
          {projectHours.length === 0 ? (
            <p className="text-[13px] italic text-light">Ingen tid logget denne uge.</p>
          ) : (
            <div className="space-y-2">
              {projectHours.slice(0, 5).map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[13px] text-mid">
                    {p.name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(p.x10 / maxProjectX10) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[12px] text-accent-bright">
                    {fmtHours(p.x10)} t
                  </span>
                </div>
              ))}
              <div className="border-t border-border-light pt-2 text-[12px] text-light">
                {fmtHours(weekTotalX10)} timer i alt denne uge
              </div>
            </div>
          )}
        </Card>

        {/* Jobsøgning */}
        <Card title="Jobsøgning" href="/jobs">
          <p className="mb-3 text-[13px] text-mid">
            <span className="text-[20px] font-medium text-accent-bright">
              {sentThisWeek}
            </span>{" "}
            sendt denne uge · {allApps.length} i alt
          </p>
          {recentApps.length === 0 ? (
            <p className="text-[13px] italic text-light">Ingen ansøgninger endnu.</p>
          ) : (
            <div className="space-y-1.5">
              {recentApps.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {a.company}
                    {a.role && <span className="text-mid"> · {a.role}</span>}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.3px] ${STATUS_CLASSES[a.status as Status]}`}
                  >
                    {STATUS_LABELS[a.status as Status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-6 py-5 transition-colors hover:border-accent-dim">
      <div className="mb-4 flex items-baseline justify-between border-b border-border-light pb-2.5">
        <div className="font-serif text-[20px] font-medium text-accent-bright">
          {title}
        </div>
        <Link href={href} className="text-[12px] text-light hover:text-accent-bright">
          åbn →
        </Link>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.5px] text-light">{label}</div>
      <div className="text-[15px] font-medium text-ink">{value}</div>
    </div>
  );
}
