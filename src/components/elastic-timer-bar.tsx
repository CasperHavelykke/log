"use client";

const MILESTONES = [16, 18, 24, 36, 48, 72, 96];

function computeMax(hours: number): number {
  for (const m of MILESTONES) {
    if (m >= hours) return m;
  }
  // Beyond known milestones — snap to nearest 24h above
  return Math.ceil(hours / 24) * 24;
}

export function ElasticTimerBar({ hours }: { hours: number }) {
  const max = computeMax(hours);
  const fillPct = Math.min(100, (hours / max) * 100);
  const targetReached = hours >= 16;
  const fillColor = targetReached ? "var(--success)" : "var(--accent-bright)";

  // Hak-mærker: kun de der er <= max
  const visibleMilestones = MILESTONES.filter((m) => m <= max);

  return (
    <div className="relative h-[60px] px-1">
      {/* Track + fill */}
      <div className="absolute left-1 right-1 top-[28px] h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${fillPct}%`, background: fillColor }}
        />
      </div>

      {/* Now-marker */}
      <div
        className="absolute top-[22px] z-10 h-[18px] w-[3px] rounded-sm transition-all duration-700 ease-out"
        style={{
          left: `calc(${fillPct}% * 0.98 + 4px)`,
          background: fillColor,
        }}
      />

      {/* Hash-mærker */}
      {visibleMilestones.map((m) => {
        const pct = (m / max) * 100;
        const isTarget = m === 16;
        const reached = hours >= m;
        return (
          <div key={m}>
            <div
              className="absolute top-[22px] h-[18px] w-[2px] -translate-x-1/2 rounded-sm transition-all duration-700 ease-out"
              style={{
                left: `calc(${pct}% * 0.98 + 4px)`,
                background: isTarget
                  ? "var(--success)"
                  : "var(--border-strong)",
                height: isTarget ? "22px" : "18px",
                top: isTarget ? "20px" : "22px",
              }}
            />
            <div
              className="absolute top-[46px] -translate-x-1/2 whitespace-nowrap text-[10px] transition-all duration-700 ease-out"
              style={{
                left: `calc(${pct}% * 0.98 + 4px)`,
                color: isTarget
                  ? "var(--success)"
                  : reached
                    ? "var(--mid)"
                    : "var(--light)",
                fontWeight: isTarget ? 600 : 400,
              }}
            >
              {m}h{isTarget && reached ? " ✓" : ""}
            </div>
          </div>
        );
      })}

      {/* "0" label */}
      <div className="absolute left-1 top-[46px] text-[10px] text-light">0</div>
    </div>
  );
}
