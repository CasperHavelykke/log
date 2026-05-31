import { FAST_QUALIFIED_MINUTES } from "@/db/schema";

export { FAST_QUALIFIED_MINUTES };

export function fastDurationMinutes(
  startedAt: string,
  endedAt?: string | null,
  now: number = Date.now(),
): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  return Math.max(0, Math.floor((end - start) / 60_000));
}

export function isQualifiedFast(durationMinutes: number): boolean {
  return durationMinutes >= FAST_QUALIFIED_MINUTES;
}

export function formatFastDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}t ${String(m).padStart(2, "0")}m`;
}

export function formatTimestampShort(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (same(d, today)) return `i dag ${hhmm}`;
  if (same(d, yesterday)) return `i går ${hhmm}`;
  return `${d.getDate()}/${d.getMonth() + 1} ${hhmm}`;
}
