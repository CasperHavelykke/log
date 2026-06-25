import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { FasteRow } from "./faste-row";

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
      <div className="mt-6 md:mt-8 md:rounded-[10px] md:bg-bg-elevated md:p-5 md:shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
        <div className="mb-3 md:mb-3.5 md:border-b md:border-hair md:pb-2.5">
          <h2 className="font-serif text-[22px] font-medium leading-none text-ink md:text-[19px] md:text-accent">
            Faste
          </h2>
        </div>
        <p className="text-[13px] italic text-light">
          Ingen afsluttede faster endnu — start en på /today.
        </p>
      </div>
    );
  }

  const durations = fasts.map((f) => durationMinutes(f.startedAt, f.endedAt!));
  const qualifiedDurations = durations.filter((d) => d >= 16 * 60);
  const shortCount = durations.length - qualifiedDurations.length;
  const qualifiedAvg =
    qualifiedDurations.length > 0
      ? Math.round(
          qualifiedDurations.reduce((a, b) => a + b, 0) /
            qualifiedDurations.length,
        )
      : null;
  const qualifiedLongest =
    qualifiedDurations.length > 0 ? Math.max(...qualifiedDurations) : null;

  return (
    <section className="mt-6 md:mt-8 md:rounded-[10px] md:bg-bg-elevated md:p-5 md:shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="mb-3 flex items-baseline justify-between md:mb-3.5 md:border-b md:border-hair md:pb-2.5">
        <h2 className="font-serif text-[22px] font-medium leading-none text-ink md:text-[19px] md:text-accent">
          Faste
        </h2>
        <span className="text-[11px] italic text-light md:text-[10px] md:uppercase md:not-italic md:tracking-[0.5px]">
          seneste 30 dage
        </span>
      </div>

      <div className="mb-3.5 grid grid-cols-3 gap-2 md:gap-2.5">
        <Stat label="Faster" value={String(qualifiedDurations.length)} />
        <Stat
          label="Snit"
          value={qualifiedAvg !== null ? fmtDuration(qualifiedAvg) : "–"}
        />
        <Stat
          label="Længste"
          value={
            qualifiedLongest !== null ? fmtDuration(qualifiedLongest) : "–"
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {fasts.slice(0, 10).map((f) => (
          <FasteRow
            key={f.id}
            id={f.id}
            startedAt={f.startedAt}
            endedAt={f.endedAt!}
            mins={durationMinutes(f.startedAt, f.endedAt!)}
          />
        ))}
      </div>

      {shortCount > 0 && (
        <p className="mt-3 text-center text-[11px] italic text-light">
          {shortCount} {shortCount === 1 ? "faste varede" : "faster varede"}{" "}
          under 16 timer og tæller ikke med i snit eller længste
        </p>
      )}

      {fasts.length > 10 && (
        <div className="mt-3 text-center text-[11px] text-light">
          … og {fasts.length - 10} ældre
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-bg-elevated px-3 py-2.5 text-center shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] md:rounded-[8px] md:bg-bg md:shadow-none">
      <div className="font-serif text-[22px] leading-none text-ink md:text-[20px]">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.5px] text-light">
        {label}
      </div>
    </div>
  );
}
