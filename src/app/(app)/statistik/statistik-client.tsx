"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { danishLongDate, toIsoDate } from "@/lib/date";

export type DataPoint = {
  date: string;
  mood?: number;
  energy?: number;
  sleepQuality?: number;
  headache?: number;
  iskias?: number;
  derm?: number;
  staph?: number;
  breathing?: number;
  alcohol?: number;
  weight?: number;
  waist?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  kcal?: number;
  sleepHours?: number;
  sleepHoursManual?: number;
  sleepHoursGarmin?: number;
  sleepScore?: number;
  hrv?: number;
  restingHr?: number;
  spo2?: number;
  bodyBatteryChange?: number;
  stress?: number;
  fastHours?: number;
  [key: string]: number | string | undefined;
};

type MetricKey =
  | "weight"
  | "waist"
  | "mood"
  | "energy"
  | "sleepQuality"
  | "headache"
  | "iskias"
  | "derm"
  | "staph"
  | "breathing"
  | "sleepHours"
  | "sleepScore"
  | "hrv"
  | "restingHr"
  | "spo2"
  | "bodyBatteryChange"
  | "stress"
  | "alcohol"
  | "fastHours"
  | "carbs"
  | "protein"
  | "fat"
  | "kcal";

type Category =
  | "body"
  | "health"
  | "symptoms"
  | "sleep"
  | "garmin"
  | "nutrition"
  | "supplements"
  | "custom"
  | "other";

type Metric = {
  key: MetricKey;
  label: string;
  short: string;
  category: Category;
  unit: string;
  color: string;
  domain?: [number, number];
  decimals: number;
};

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "body", label: "Kropsmål" },
  { id: "health", label: "Helbred" },
  { id: "sleep", label: "Søvn" },
  { id: "garmin", label: "Garmin biometri" },
  { id: "nutrition", label: "Ernæring" },
  { id: "symptoms", label: "Symptomer" },
  { id: "supplements", label: "Kosttilskud" },
  { id: "custom", label: "Egne målinger" },
  { id: "other", label: "Andet" },
];

const CUSTOM_COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#4ade80",
  "#fb923c",
  "#ec4899",
  "#eab308",
  "#5fa3f0",
  "#f87171",
];

const SUPPLEMENT_COLORS = [
  "#4ade80",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#ec4899",
  "#eab308",
  "#5fa3f0",
  "#f87171",
];

const METRICS: Metric[] = [
  { key: "weight", label: "Vægt", short: "Vægt", category: "body", unit: "kg", color: "#5fa3f0", decimals: 1 },
  { key: "waist", label: "Livvidde", short: "Livvidde", category: "body", unit: "cm", color: "#f97316", decimals: 1 },
  { key: "mood", label: "Humør", short: "Humør", category: "health", unit: "/5", domain: [1, 5], color: "#4ade80", decimals: 0 },
  { key: "energy", label: "Energi", short: "Energi", category: "health", unit: "/5", domain: [1, 5], color: "#fbbf24", decimals: 0 },
  { key: "sleepQuality", label: "Søvnkvalitet", short: "Søvnkval.", category: "health", unit: "/4", domain: [1, 4], color: "#a78bfa", decimals: 0 },
  { key: "sleepHours", label: "Søvnvarighed", short: "Søvn", category: "sleep", unit: "t", color: "#5fa3f0", decimals: 1 },
  { key: "sleepScore", label: "Søvnscore (Garmin)", short: "Søvnscore", category: "sleep", unit: "/100", domain: [0, 100], color: "#4ade80", decimals: 0 },
  { key: "hrv", label: "HRV", short: "HRV", category: "garmin", unit: "ms", color: "#a78bfa", decimals: 0 },
  { key: "restingHr", label: "Hvilepuls", short: "Hvilepuls", category: "garmin", unit: "bpm", color: "#fb923c", decimals: 0 },
  { key: "spo2", label: "SpO₂ (snit)", short: "SpO₂", category: "garmin", unit: "%", color: "#22d3ee", decimals: 0 },
  { key: "bodyBatteryChange", label: "Body Battery (ændring)", short: "BB-ændring", category: "garmin", unit: "", color: "#4ade80", decimals: 0 },
  { key: "stress", label: "Stress (snit)", short: "Stress", category: "garmin", unit: "/100", domain: [0, 100], color: "#f87171", decimals: 0 },
  { key: "headache", label: "Hovedpine-intensitet", short: "Hovedpine", category: "symptoms", unit: "/10", domain: [0, 10], color: "#f87171", decimals: 0 },
  { key: "iskias", label: "Iskias-smerte", short: "Iskias", category: "symptoms", unit: "/5", domain: [1, 5], color: "#fb923c", decimals: 0 },
  { key: "derm", label: "Skæleksem", short: "Skæleksem", category: "symptoms", unit: "/5", domain: [1, 5], color: "#eab308", decimals: 0 },
  { key: "staph", label: "Stafylokokker", short: "Stafylokk.", category: "symptoms", unit: "/5", domain: [1, 5], color: "#ec4899", decimals: 0 },
  { key: "breathing", label: "Vejrtrækningsbesvær", short: "Vejrtr.", category: "symptoms", unit: "/5", domain: [1, 5], color: "#22d3ee", decimals: 0 },
  { key: "alcohol", label: "Alkohol", short: "Alkohol", category: "other", unit: " g", color: "#fbbf24", decimals: 0 },
  { key: "fastHours", label: "Faste-varighed", short: "Faste", category: "other", unit: "t", color: "#a78bfa", decimals: 1 },
  { key: "carbs", label: "Kulhydrater", short: "Carbs", category: "nutrition", unit: " g", color: "#fbbf24", decimals: 0 },
  { key: "protein", label: "Protein", short: "Protein", category: "nutrition", unit: " g", color: "#ec4899", decimals: 0 },
  { key: "fat", label: "Fedt", short: "Fedt", category: "nutrition", unit: " g", color: "#a78bfa", decimals: 0 },
  { key: "kcal", label: "Kalorier", short: "Kcal", category: "nutrition", unit: " kcal", color: "#f97316", decimals: 0 },
];


const RANGES = [
  { id: "30d", label: "30 dage", days: 30 },
  { id: "90d", label: "90 dage", days: 90 },
  { id: "6m", label: "6 mdr", days: 183 },
  { id: "1y", label: "1 år", days: 365 },
  { id: "all", label: "Alt", days: null },
] as const;

const OVERLAY_COLORS = ["#5fa3f0", "#f87171", "#4ade80", "#fbbf24"];
const MAX_OVERLAY = 4;

const SHORT_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}. ${SHORT_MONTHS[m - 1]}`;
}

function fmt(value: number, decimals: number): string {
  return value
    .toFixed(decimals)
    .replace(".", ",")
    .replace(/,0$/, "");
}

function rollingMean(
  data: DataPoint[],
  key: MetricKey,
  windowSize = 7,
): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const values: number[] = [];
    for (let j = start; j <= i; j++) {
      const v = data[j][key];
      if (typeof v === "number") values.push(v);
    }
    if (values.length >= 3) {
      out.push(values.reduce((a, b) => a + b, 0) / values.length);
    } else {
      out.push(undefined);
    }
  }
  return out;
}

function attachMA(data: DataPoint[], keys: MetricKey[]): DataPoint[] {
  if (data.length === 0 || keys.length === 0) return data;
  const enriched: DataPoint[] = data.map((d) => ({ ...d }));
  for (const k of keys) {
    const ma = rollingMean(enriched, k, 7);
    for (let i = 0; i < enriched.length; i++) {
      if (ma[i] !== undefined) enriched[i][`${k}__ma`] = ma[i];
    }
  }
  return enriched;
}

function statsFor(data: DataPoint[], key: MetricKey) {
  const values = data
    .map((d) => d[key])
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    latest: values[values.length - 1],
  };
}

function fromIsoNDaysAgo(days: number): string {
  const now = new Date();
  const from = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days + 1,
  );
  return toIsoDate(from);
}

export function StatistikClient({
  data,
  supplementMetrics,
  customMetrics,
}: {
  data: DataPoint[];
  supplementMetrics: { metricKey: string; label: string; unit: string }[];
  customMetrics: {
    metricKey: string;
    label: string;
    unit: string;
    kind: string;
  }[];
}) {
  const dynamicMetrics: Metric[] = supplementMetrics.map((s, i) => ({
    key: s.metricKey as MetricKey,
    label: s.label,
    short: s.label.length > 16 ? s.label.slice(0, 14) + "…" : s.label,
    category: "supplements",
    unit: s.unit,
    color: SUPPLEMENT_COLORS[i % SUPPLEMENT_COLORS.length],
    decimals: 1,
  }));

  const customDynamicMetrics: Metric[] = customMetrics.map((c, i) => {
    let domain: [number, number] | undefined;
    let decimals = 1;
    if (c.kind === "boolean") {
      domain = [0, 1];
      decimals = 0;
    } else if (c.kind === "scale_5" || c.kind === "bool_scale_5") {
      domain = [1, 5];
      decimals = 0;
    } else if (c.kind === "scale_10" || c.kind === "bool_scale_10") {
      domain = [1, 10];
      decimals = 0;
    }
    return {
      key: c.metricKey as MetricKey,
      label: c.label,
      short: c.label.length > 16 ? c.label.slice(0, 14) + "…" : c.label,
      category: "custom",
      unit: c.unit,
      color: CUSTOM_COLORS[i % CUSTOM_COLORS.length],
      domain,
      decimals,
    };
  });

  const ALL_METRICS = [...METRICS, ...dynamicMetrics, ...customDynamicMetrics];
  const METRIC_BY_KEY = new Map(ALL_METRICS.map((m) => [m.key, m]));
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("90d");
  const [mode, setMode] = useState<"stacked" | "overlay">("stacked");
  const [showMA, setShowMA] = useState(true);
  const [selected, setSelected] = useState<Set<MetricKey>>(
    () => new Set<MetricKey>(["weight", "sleepHours", "mood", "energy"]),
  );

  const range = RANGES.find((r) => r.id === rangeId)!;

  const filteredData = useMemo(() => {
    if (range.days === null) return data;
    const from = fromIsoNDaysAgo(range.days);
    return data.filter((d) => d.date >= from);
  }, [data, range]);

  const selectedMetrics = useMemo(
    () =>
      [...selected]
        .map((k) => METRIC_BY_KEY.get(k))
        .filter((m): m is Metric => !!m),
    [selected],
  );

  const dataWithMA = useMemo(
    () =>
      showMA
        ? attachMA(
            filteredData,
            selectedMetrics.map((m) => m.key),
          )
        : filteredData,
    [filteredData, selectedMetrics, showMA],
  );

  function toggle(k: MetricKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const overlayMetrics = selectedMetrics.slice(0, MAX_OVERLAY);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <h1 className="font-serif text-[32px] font-medium leading-none text-ink">
          Statistik
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <RangePicker value={rangeId} onChange={setRangeId} />
          <ModeToggle value={mode} onChange={setMode} />
          <label className="flex items-center gap-2 text-[12px] text-mid">
            <input
              type="checkbox"
              checked={showMA}
              onChange={(e) => setShowMA(e.target.checked)}
              className="size-3.5"
            />
            7-dages snit
          </label>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <MetricPicker
          selected={selected}
          onToggle={toggle}
          data={filteredData}
          allMetrics={ALL_METRICS}
        />

        <div className="space-y-3">
          {selectedMetrics.length === 0 ? (
            <EmptyState text="Vælg en eller flere metrics i venstre panel." />
          ) : mode === "stacked" ? (
            <StackedView
              metrics={selectedMetrics}
              data={dataWithMA}
              showMA={showMA}
            />
          ) : (
            <OverlayView
              metrics={overlayMetrics}
              all={selectedMetrics}
              data={dataWithMA}
              showMA={showMA}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RangePicker({
  value,
  onChange,
}: {
  value: (typeof RANGES)[number]["id"];
  onChange: (id: (typeof RANGES)[number]["id"]) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`rounded px-2.5 py-1 text-[12px] transition ${
            value === r.id
              ? "bg-accent/20 text-accent-bright"
              : "text-mid hover:text-ink"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: "stacked" | "overlay";
  onChange: (v: "stacked" | "overlay") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={() => onChange("stacked")}
        className={`rounded px-2.5 py-1 text-[12px] transition ${
          value === "stacked"
            ? "bg-accent/20 text-accent-bright"
            : "text-mid hover:text-ink"
        }`}
      >
        Stablet
      </button>
      <button
        type="button"
        onClick={() => onChange("overlay")}
        className={`rounded px-2.5 py-1 text-[12px] transition ${
          value === "overlay"
            ? "bg-accent/20 text-accent-bright"
            : "text-mid hover:text-ink"
        }`}
      >
        Overlay
      </button>
    </div>
  );
}

function MetricPicker({
  selected,
  onToggle,
  data,
  allMetrics,
}: {
  selected: Set<MetricKey>;
  onToggle: (k: MetricKey) => void;
  data: DataPoint[];
  allMetrics: Metric[];
}) {
  const counts = useMemo(() => {
    const m = new Map<MetricKey, number>();
    for (const row of data) {
      for (const metric of allMetrics) {
        if (typeof row[metric.key] === "number") {
          m.set(metric.key, (m.get(metric.key) ?? 0) + 1);
        }
      }
    }
    return m;
  }, [data, allMetrics]);

  return (
    <aside className="space-y-3 self-start rounded-md border border-border bg-card p-3">
      {CATEGORIES.map((cat) => {
        const metrics = allMetrics.filter((m) => m.category === cat.id);
        if (metrics.length === 0) return null;
        return (
          <div key={cat.id}>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.6px] text-light">
              {cat.label}
            </div>
            <div className="space-y-1">
              {metrics.map((m) => {
                const count = counts.get(m.key) ?? 0;
                const has = count > 0;
                const isSelected = selected.has(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onToggle(m.key)}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] transition ${
                      isSelected
                        ? "bg-accent/10"
                        : "hover:bg-border-light"
                    } ${has ? "text-ink" : "text-dim"}`}
                  >
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? m.color
                          : "transparent",
                        border: `1px solid ${
                          isSelected ? m.color : "var(--border)"
                        }`,
                      }}
                    />
                    <span className="flex-1 truncate">{m.label}</span>
                    <span className="text-[10px] text-light">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 px-6 py-12 text-center text-[13px] italic text-light">
      {text}
    </div>
  );
}

function MetricHeader({
  metric,
  data,
}: {
  metric: Metric;
  data: DataPoint[];
}) {
  const s = statsFor(data, metric.key);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-light pb-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: metric.color }}
        />
        <span className="font-serif text-[16px] text-ink">{metric.label}</span>
        {metric.unit && (
          <span className="text-[11px] text-light">({metric.unit.trim()})</span>
        )}
      </div>
      {s ? (
        <div className="flex gap-3 text-[11px] text-mid">
          <span>
            Seneste:{" "}
            <span className="text-ink">
              {fmt(s.latest, metric.decimals)}
              {metric.unit}
            </span>
          </span>
          <span>
            Ø{" "}
            <span className="text-ink">
              {fmt(s.avg, metric.decimals === 0 ? 1 : metric.decimals)}
              {metric.unit}
            </span>
          </span>
          <span>
            Min/Max{" "}
            <span className="text-ink">
              {fmt(s.min, metric.decimals)}–{fmt(s.max, metric.decimals)}
            </span>
          </span>
          <span className="text-light">· {s.count} dage</span>
        </div>
      ) : (
        <span className="text-[11px] italic text-light">Ingen data</span>
      )}
    </div>
  );
}

function StackedView({
  metrics,
  data,
  showMA,
}: {
  metrics: Metric[];
  data: DataPoint[];
  showMA: boolean;
}) {
  return (
    <div className="space-y-3">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="rounded-md border border-border bg-card p-3"
        >
          <MetricHeader metric={m} data={data} />
          <div className="mt-2 h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                syncId="statistik"
                margin={{ top: 4, right: 12, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--border-light)"
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--light)"
                  fontSize={10}
                  tickFormatter={shortDate}
                  tickMargin={4}
                  minTickGap={36}
                />
                <YAxis
                  stroke="var(--light)"
                  fontSize={10}
                  width={36}
                  domain={m.domain ?? ["auto", "auto"]}
                  tickFormatter={(v: number) => fmt(v, m.decimals)}
                />
                <Tooltip
                  content={<ChartTooltip metrics={[m]} showMA={showMA} />}
                  cursor={{
                    stroke: "var(--accent)",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                />
                {showMA && (
                  <Line
                    type="monotone"
                    dataKey={`${m.key}__ma`}
                    stroke={m.color}
                    strokeWidth={2}
                    strokeOpacity={0.35}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: m.color, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverlayView({
  metrics,
  all,
  data,
  showMA,
}: {
  metrics: Metric[];
  all: Metric[];
  data: DataPoint[];
  showMA: boolean;
}) {
  const overflow = all.length - metrics.length;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-border-light pb-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {metrics.map((m, i) => (
            <div key={m.key} className="flex items-center gap-1.5 text-[12px]">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: OVERLAY_COLORS[i] }}
              />
              <span className="text-ink">{m.label}</span>
              {m.unit && (
                <span className="text-light">({m.unit.trim()})</span>
              )}
            </div>
          ))}
        </div>
        {overflow > 0 && (
          <span className="text-[11px] italic text-warning">
            Overlay viser max {MAX_OVERLAY} — {overflow} valgt{overflow > 1 ? "e" : ""} vises ikke
          </span>
        )}
      </div>
      <div className="h-[460px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              stroke="var(--border-light)"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="var(--light)"
              fontSize={11}
              tickFormatter={shortDate}
              tickMargin={6}
              minTickGap={48}
            />
            {metrics.map((m, i) => (
              <YAxis
                key={m.key}
                yAxisId={m.key}
                stroke={OVERLAY_COLORS[i]}
                fontSize={10}
                width={40}
                orientation={i % 2 === 0 ? "left" : "right"}
                domain={m.domain ?? ["auto", "auto"]}
                tickFormatter={(v: number) => fmt(v, m.decimals)}
              />
            ))}
            <Tooltip
              content={
                <ChartTooltip
                  metrics={metrics}
                  showMA={showMA}
                  colorByIndex={OVERLAY_COLORS}
                />
              }
              cursor={{
                stroke: "var(--accent)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
            />
            {metrics.map((m, i) => (
              <Line
                key={m.key}
                yAxisId={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={OVERLAY_COLORS[i]}
                strokeWidth={1.8}
                dot={{ r: 2, fill: OVERLAY_COLORS[i], strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {showMA &&
              metrics.map((m, i) => (
                <Line
                  key={`ma-${m.key}`}
                  yAxisId={m.key}
                  type="monotone"
                  dataKey={`${m.key}__ma`}
                  stroke={OVERLAY_COLORS[i]}
                  strokeWidth={2}
                  strokeOpacity={0.3}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type TooltipPayloadEntry = {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
};

function ChartTooltip({
  active,
  payload,
  label,
  metrics,
  showMA,
  colorByIndex,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  metrics: Metric[];
  showMA: boolean;
  colorByIndex?: string[];
}) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const rows: { color: string; label: string; value: string; isMA: boolean }[] =
    [];
  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    const color = colorByIndex?.[i] ?? m.color;
    const entry = payload.find((p) => p.dataKey === m.key);
    if (entry && typeof entry.value === "number") {
      rows.push({
        color,
        label: m.short,
        value: `${fmt(entry.value, m.decimals)}${m.unit}`,
        isMA: false,
      });
    }
    if (showMA) {
      const maEntry = payload.find((p) => p.dataKey === `${m.key}__ma`);
      if (maEntry && typeof maEntry.value === "number") {
        rows.push({
          color,
          label: `${m.short} · 7d`,
          value: `${fmt(maEntry.value, m.decimals + 1)}${m.unit}`,
          isMA: true,
        });
      }
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-page/95 px-2.5 py-2 text-[11px] shadow-lg backdrop-blur">
      <div className="mb-1 text-mid">{danishLongDate(label)}</div>
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block size-1.5 rounded-full"
              style={{
                backgroundColor: r.color,
                opacity: r.isMA ? 0.5 : 1,
              }}
            />
            <span className="text-light">{r.label}:</span>
            <span className="text-ink">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
