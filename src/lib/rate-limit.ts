type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

// Nøglerne er delvist angriber-kontrollerede (emails, IP'er) — uden et
// loft er Map'et en langsom hukommelseslækage. Ved loftet ryddes udløbne
// entries; er alt aktivt, ofres de ældste (fail-open for de færreste).
const MAX_BUCKETS = 10_000;

function evict(now: number) {
  for (const [k, e] of buckets) {
    if (e.resetAt < now) buckets.delete(k);
  }
  if (buckets.size < MAX_BUCKETS) return;
  const overshoot = buckets.size - MAX_BUCKETS + 1;
  const keys = [...buckets.entries()]
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, overshoot);
  for (const [k] of keys) buckets.delete(k);
}

export function rateLimit(key: string, maxAttempts: number, windowMs: number) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt < now) {
    if (buckets.size >= MAX_BUCKETS) evict(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: maxAttempts - 1, retryAfterSec: 0 };
  }

  if (entry.count >= maxAttempts) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { ok: true, remaining: maxAttempts - entry.count, retryAfterSec: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
