import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Check, Clock } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

function durationMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.floor((end - start) / 60_000));
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}t ${String(m).padStart(2, "0")}m`;
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "i dag";
  if (days === 1) return "i går";
  if (days === 2) return "i forgårs";
  if (days < 7) return `for ${days} dage siden`;
  return `${d.getDate()}. ${["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][d.getMonth()]}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function FasteHistory() {
  const user = await requireUser();
  const fasts = await db
    .select()
    .from(schema.fasts)
    .where(
      and(eq(schema.fasts.userId, user.id), isNotNull(schema.fasts.endedAt)),
    )
    .orderBy(desc(schema.fasts.startedAt))
    .limit(30);

  if (fasts.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card px-5 py-6 text-center">
        <p className="text-[13px] italic text-light">
          Ingen afsluttede faster endnu — start en på /today.
        </p>
      </div>
    );
  }

  const durations = fasts.map((f) => durationMinutes(f.startedAt, f.endedAt!));
  const reachedTarget = durations.filter((d) => d >= 16 * 60).length;
  const avgMins = Math.round(
    durations.reduce((a, b) => a + b, 0) / durations.length,
  );

  return (
    <section className="rounded-md border border-border bg-card px-5 py-5">
      <div className="mb-4 flex items-baseline justify-between border-b border-border-light pb-3">
        <h2 className="font-serif text-[20px] font-medium text-accent-bright">
          Faste-historik
        </h2>
        <span className="text-[11px] italic text-light">
          seneste {fasts.length}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Faster" value={fasts.length} />
        <Stat label="Nået mål" value={`${reachedTarget}/${fasts.length}`} />
        <Stat label="Snit" value={fmtDuration(avgMins)} />
      </div>

      <div className="space-y-2">
        {fasts.slice(0, 10).map((f) => {
          const mins = durationMinutes(f.startedAt, f.endedAt!);
          const hit16 = mins >= 16 * 60;
          return (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-[4px] border border-border-light bg-bg px-3 py-2.5"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                  hit16
                    ? "bg-[rgba(74,222,128,0.12)] text-success"
                    : "bg-[rgba(245,185,66,0.12)] text-warning"
                }`}
              >
                {hit16 ? (
                  <Check className="size-3.5" />
                ) : (
                  <Clock className="size-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink">
                  {fmtDuration(mins)}
                </div>
                <div className="text-[11px] text-mid">
                  {fmtRelative(f.startedAt)} · {fmtTime(f.startedAt)} →{" "}
                  {fmtTime(f.endedAt!)}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-[3px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] ${
                  hit16
                    ? "bg-[rgba(74,222,128,0.12)] text-success"
                    : "bg-[rgba(245,185,66,0.12)] text-warning"
                }`}
              >
                {hit16
                  ? mins > 16 * 60
                    ? `+${Math.round((mins - 16 * 60) / 60)}t`
                    : "mål"
                  : "kort"}
              </span>
            </div>
          );
        })}
      </div>

      {fasts.length > 10 && (
        <div className="mt-4 text-center text-[12px] text-light">
          ... og {fasts.length - 10} ældre
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[4px] border border-border-light bg-bg px-3 py-2.5 text-center">
      <div className="font-serif text-[20px] leading-none text-ink">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.5px] text-mid">
        {label}
      </div>
    </div>
  );
}
