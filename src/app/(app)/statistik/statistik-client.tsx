"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  X,
} from "lucide-react";
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
  | "exercise"
  | "sleepQuality"
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
  | "training"
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
  // Foldbare serier (Øvelser): sub-rækker skjules til gruppen foldes ud.
  group?: string;
  sub?: boolean;
};

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "body", label: "Kropsmål" },
  { id: "health", label: "Helbred" },
  { id: "training", label: "Øvelser" },
  { id: "sleep", label: "Søvn" },
  { id: "garmin", label: "Garmin biometri" },
  { id: "nutrition", label: "Ernæring" },
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
  // Ja/nej-metrik (domain fra 0) — primært til metrik-kalenderen; grafen
  // bliver en flad 0/1-linje men tælleren og kalenderen er pointen.
  { key: "exercise", label: "Træning", short: "Træning", category: "health", unit: "", domain: [0, 1], color: "#6ea9f2", decimals: 0 },
  { key: "sleepQuality", label: "Søvnkvalitet", short: "Søvnkval.", category: "sleep", unit: "/4", domain: [1, 4], color: "#a78bfa", decimals: 0 },
  { key: "sleepHours", label: "Søvnvarighed", short: "Søvn", category: "sleep", unit: "t", color: "#5fa3f0", decimals: 1 },
  { key: "sleepScore", label: "Søvnscore (Garmin)", short: "Søvnscore", category: "sleep", unit: "/100", domain: [0, 100], color: "#4ade80", decimals: 0 },
  { key: "hrv", label: "HRV", short: "HRV", category: "garmin", unit: "ms", color: "#a78bfa", decimals: 0 },
  { key: "restingHr", label: "Hvilepuls", short: "Hvilepuls", category: "garmin", unit: "bpm", color: "#fb923c", decimals: 0 },
  { key: "spo2", label: "SpO₂ (snit)", short: "SpO₂", category: "garmin", unit: "%", color: "#22d3ee", decimals: 0 },
  { key: "bodyBatteryChange", label: "Body Battery (ændring)", short: "BB-ændring", category: "garmin", unit: "", color: "#4ade80", decimals: 0 },
  { key: "stress", label: "Stress (snit)", short: "Stress", category: "garmin", unit: "/100", domain: [0, 100], color: "#f87171", decimals: 0 },
  { key: "alcohol", label: "Alkohol", short: "Alkohol", category: "other", unit: " g", color: "#fbbf24", decimals: 0 },
  { key: "fastHours", label: "Faste-varighed", short: "Faste", category: "other", unit: "t", color: "#a78bfa", decimals: 1 },
  { key: "carbs", label: "Kulhydrater", short: "Carbs", category: "nutrition", unit: " g", color: "#fbbf24", decimals: 0 },
  { key: "protein", label: "Protein", short: "Protein", category: "nutrition", unit: " g", color: "#ec4899", decimals: 0 },
  { key: "fat", label: "Fedt", short: "Fedt", category: "nutrition", unit: " g", color: "#a78bfa", decimals: 0 },
  { key: "kcal", label: "Kalorier", short: "Kcal", category: "nutrition", unit: " kcal", color: "#f97316", decimals: 0 },
];


const SELECTED_STORAGE_KEY = "statistik-selected-metrics";

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
  exerciseMetrics,
  garminSleepEnabled,
}: {
  data: DataPoint[];
  supplementMetrics: { metricKey: string; label: string; unit: string }[];
  customMetrics: {
    metricKey: string;
    label: string;
    unit: string;
    kind: string;
  }[];
  exerciseMetrics: {
    metricKey: string;
    label: string;
    unit: string;
    group: string;
    sub: boolean;
  }[];
  garminSleepEnabled: boolean;
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

  // Øvelses-progression: vægtede øvelser i kg (1 decimal), resten reps/sek.
  const exerciseDynamicMetrics: Metric[] = exerciseMetrics.map((e, i) => ({
    key: e.metricKey as MetricKey,
    label: e.label,
    short: e.label.length > 16 ? e.label.slice(0, 14) + "…" : e.label,
    category: "training",
    unit: e.unit,
    color: SUPPLEMENT_COLORS[(i + 3) % SUPPLEMENT_COLORS.length],
    decimals: e.unit.trim() === "kg" ? 1 : 0,
    group: e.group,
    sub: e.sub,
  }));

  const ALL_METRICS = [
    ...METRICS,
    ...dynamicMetrics,
    ...customDynamicMetrics,
    ...exerciseDynamicMetrics,
  ];
  const METRIC_BY_KEY = new Map(ALL_METRICS.map((m) => [m.key, m]));
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("90d");
  const [mode, setMode] = useState<"stacked" | "overlay">("stacked");
  const [showMA, setShowMA] = useState(true);
  const [selected, setSelected] = useState<Set<MetricKey>>(
    () => new Set<MetricKey>(["weight", "sleepHours", "mood", "energy"]),
  );
  // Valget huskes i browseren, så man ikke skal fravælge standardvalgene
  // hver gang. Indlæses i en effect (ikke i initializeren) så server- og
  // klient-HTML matcher ved hydrering.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTED_STORAGE_KEY);
      if (raw) setSelected(new Set(JSON.parse(raw) as MetricKey[]));
    } catch {
      // Korrupt/utilgængelig storage → behold defaults.
    }
  }, []);
  // Kalender-visning af én metrik ad gangen (åbnes via ikon i venstre panel).
  const [calendarMetric, setCalendarMetric] = useState<MetricKey | null>(null);

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
      try {
        localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Storage fuld/utilgængelig — valget virker stadig for sessionen.
      }
      return next;
    });
  }

  const overlayMetrics = selectedMetrics.slice(0, MAX_OVERLAY);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 py-8">
      <header className="border-b border-hair pb-5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
          Statistik
        </div>
        <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
          Oversigt
        </h1>
      </header>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <MetricPicker
          selected={selected}
          onToggle={toggle}
          data={filteredData}
          allMetrics={ALL_METRICS}
          garminSleepEnabled={garminSleepEnabled}
          calendarMetric={calendarMetric}
          onOpenCalendar={(k) =>
            setCalendarMetric((prev) => (prev === k ? null : k))
          }
        />

        <div className="space-y-3">
          {calendarMetric !== null && METRIC_BY_KEY.has(calendarMetric) && (
            <MetricCalendar
              metric={METRIC_BY_KEY.get(calendarMetric)!}
              data={data}
              garminSleepEnabled={garminSleepEnabled}
              onClose={() => setCalendarMetric(null)}
            />
          )}
          {/* Graf-kontroller bor hos graferne — på mobil ligger metric-
              listen ellers imellem, og man skulle scrolle forbi den. */}
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
    <div className="inline-flex rounded-[8px] bg-bg-elevated p-0.5 md:bg-bg-subtle">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] transition-colors ${
            value === r.id
              ? "bg-accent text-white"
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
    <div className="inline-flex rounded-[8px] bg-bg-elevated p-0.5 md:bg-bg-subtle">
      <button
        type="button"
        onClick={() => onChange("stacked")}
        className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] transition-colors ${
          value === "stacked"
            ? "bg-accent text-white"
            : "text-mid hover:text-ink"
        }`}
      >
        Stablet
      </button>
      <button
        type="button"
        onClick={() => onChange("overlay")}
        className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] transition-colors ${
          value === "overlay"
            ? "bg-accent text-white"
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
  garminSleepEnabled,
  calendarMetric,
  onOpenCalendar,
}: {
  selected: Set<MetricKey>;
  onToggle: (k: MetricKey) => void;
  data: DataPoint[];
  allMetrics: Metric[];
  garminSleepEnabled: boolean;
  calendarMetric: MetricKey | null;
  onOpenCalendar: (k: MetricKey) => void;
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

  // Foldbare øvelses-grupper: sub-serier (vægt/reps) skjules indtil den
  // primære række (est. 1RM) foldes ud — eller hvis de allerede er valgt.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  function toggleGroup(group: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <aside className="space-y-3 self-start md:rounded-[10px] md:bg-bg-elevated md:p-5 md:shadow-[var(--shadow-card)]">
      {CATEGORIES.map((cat) => {
        if (cat.id === "garmin" && !garminSleepEnabled) return null;
        const metrics = allMetrics
          .filter((m) => m.category === cat.id)
          .filter((m) => {
            if (m.key === "sleepScore" && !garminSleepEnabled) return false;
            if (m.key === "sleepQuality" && garminSleepEnabled) return false;
            return true;
          });
        if (metrics.length === 0) return null;
        const label =
          cat.id === "sleep" && garminSleepEnabled
            ? "Garmin søvndata"
            : cat.label;
        return (
          <div key={cat.id}>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.6px] text-light">
              {label}
            </div>
            <div className="space-y-1">
              {metrics.map((m) => {
                const count = counts.get(m.key) ?? 0;
                const has = count > 0;
                const isSelected = selected.has(m.key);
                const isCalendarActive = calendarMetric === m.key;
                const hasSubs =
                  !m.sub &&
                  m.group !== undefined &&
                  metrics.some((x) => x.sub && x.group === m.group);
                if (
                  m.sub &&
                  m.group !== undefined &&
                  !expandedGroups.has(m.group) &&
                  !isSelected &&
                  !isCalendarActive
                ) {
                  return null;
                }
                return (
                  <div
                    key={m.key}
                    className={`flex w-full items-center rounded transition ${
                      isSelected ? "bg-accent/10" : "hover:bg-border-light"
                    } ${m.sub ? "ml-4" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggle(m.key)}
                      className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-1.5 py-1 text-left text-[13px] ${
                        has ? "text-ink" : "text-dim"
                      }`}
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
                      <span className="flex-1 truncate">
                        {m.sub && m.group !== undefined
                          ? m.label.slice(m.group.length + 3) || m.label
                          : m.label}
                      </span>
                      <span className="text-[10px] text-light">{count}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCalendar(m.key)}
                      title={`Vis ${m.label} i kalender`}
                      aria-pressed={isCalendarActive}
                      className={`inline-flex shrink-0 cursor-pointer items-center rounded p-1.5 transition-colors ${
                        isCalendarActive
                          ? "text-accent"
                          : "text-dim hover:text-mid"
                      }`}
                    >
                      <CalendarDays className="size-3.5" />
                    </button>
                    {hasSubs ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(m.group!)}
                        title={
                          expandedGroups.has(m.group!)
                            ? "Skjul vægt- og reps-serier"
                            : "Vis vægt- og reps-serier"
                        }
                        aria-expanded={expandedGroups.has(m.group!)}
                        className="inline-flex shrink-0 cursor-pointer items-center rounded p-1.5 text-dim transition-colors hover:text-mid"
                      >
                        <ChevronRight
                          className={`size-3.5 transition-transform ${
                            expandedGroups.has(m.group!) ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                    ) : (
                      // Fast plads så rækker med/uden pil flugter.
                      cat.id === "training" && (
                        <span className="w-[26px] shrink-0" />
                      )
                    )}
                  </div>
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
    <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
      {text}
    </div>
  );
}

// --- Metrik-kalender ---------------------------------------------------------
// Read-only kalender der viser på hvilke dage en metrik er registreret.
// Ja/nej-metrikker (domain fra 0): kun prik ved "ja" (>0). Alt andet: prik
// når der findes en værdi. Data er hele historikken — ingen server-kald.

const CAL_MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];
const CAL_MONTHS_SHORT = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];
const CAL_WEEKDAYS = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

function calPad(n: number) {
  return String(n).padStart(2, "0");
}
function calIso(y: number, m: number, d: number) {
  return `${y}-${calPad(m + 1)}-${calPad(d)}`;
}
function calDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function calFirstWeekday(y: number, m: number) {
  return (new Date(y, m, 1).getDay() + 6) % 7;
}

function metricHit(metric: Metric, value: unknown): boolean {
  if (typeof value !== "number") return false;
  if (metric.domain && metric.domain[0] === 0) return value > 0;
  return true;
}

// Hex-farve + alpha (0-1) → 8-cifret hex. Metric-farverne er alle #rrggbb.
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// Intensitet 0-1 for en dags værdi (bruges som celle-baggrundens alpha, så
// bevidst dæmpet af hensyn til læsbarheden af dag-nummeret). Ja/nej-
// metrikker: fast mellemtone. Øvrige: normaliseret over metrikens
// registrerede min-max, med bund så laveste værdi stadig er synlig.
function heatAlpha(
  metric: Metric,
  value: number,
  min: number,
  max: number,
): number {
  if (metric.domain && metric.domain[0] === 0) return 0.5;
  if (max <= min) return 0.45;
  return 0.15 + 0.5 * ((value - min) / (max - min));
}

// Samme farvelogik som /helbred-kalenderens søvnscore-badge.
function calScoreClasses(score: number): string {
  if (score >= 80) return "bg-[var(--success-soft)] text-success";
  if (score >= 60) return "bg-[var(--warning-soft)] text-warning";
  return "bg-[var(--danger-soft)] text-danger";
}

function MetricCalendar({
  metric,
  data,
  garminSleepEnabled,
  onClose,
}: {
  metric: Metric;
  data: DataPoint[];
  garminSleepEnabled: boolean;
  onClose: () => void;
}) {
  const now = new Date();
  const [view, setView] = useState<"month" | "year">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // date → værdi for alle dage hvor metrikken "tæller", plus min/max til
  // intensitets-normalisering.
  const { hits, minVal, maxVal } = useMemo(() => {
    const m = new Map<string, number>();
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of data) {
      const v = row[metric.key];
      if (metricHit(metric, v)) {
        const n = v as number;
        m.set(row.date, n);
        if (n < lo) lo = n;
        if (n > hi) hi = n;
      }
    }
    return { hits: m, minVal: lo, maxVal: hi };
  }, [data, metric]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Træning + Garmin-score til /helbred-style markører i cellerne.
  const { exerciseDates, sleepScores } = useMemo(() => {
    const ex = new Set<string>();
    const sc = new Map<string, number>();
    for (const row of data) {
      if (row.exercise === 1) ex.add(row.date);
      if (typeof row.sleepScore === "number") sc.set(row.date, row.sleepScore);
    }
    return { exerciseDates: ex, sleepScores: sc };
  }, [data]);

  const monthPrefix = `${year}-${calPad(month + 1)}`;
  const monthCount = useMemo(
    () => [...hits.keys()].filter((d) => d.startsWith(monthPrefix)).length,
    [hits, monthPrefix],
  );
  const yearCount = useMemo(
    () => [...hits.keys()].filter((d) => d.startsWith(`${year}-`)).length,
    [hits, year],
  );

  return (
    <section className="md:rounded-[10px] md:bg-bg-elevated md:p-5 md:shadow-[var(--shadow-card)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-hair pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: metric.color }}
          />
          <span className="truncate font-serif text-[16px] text-ink">
            {metric.label}
          </span>
          <span className="shrink-0 text-[11px] text-light">
            {view === "month"
              ? `${monthCount} dag${monthCount === 1 ? "" : "e"}`
              : `${yearCount} dag${yearCount === 1 ? "" : "e"} i ${year}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-[8px] bg-bg-elevated p-0.5 md:bg-bg">
            <button
              type="button"
              onClick={() => setView("month")}
              className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] transition-colors ${
                view === "month" ? "bg-accent text-white" : "text-mid hover:text-ink"
              }`}
            >
              Måned
            </button>
            <button
              type="button"
              onClick={() => setView("year")}
              className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[12px] transition-colors ${
                view === "year" ? "bg-accent text-white" : "text-mid hover:text-ink"
              }`}
            >
              År
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk kalender"
            className="inline-flex cursor-pointer items-center rounded-[6px] p-1.5 text-dim hover:bg-bg hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (view === "month" ? shiftMonth(-1) : setYear(year - 1))}
          aria-label="Forrige"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[8px] bg-bg-elevated text-mid hover:text-ink sm:size-7 md:bg-bg"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[13px] font-medium text-ink">
          {view === "month" ? `${CAL_MONTHS[month]} ${year}` : year}
        </span>
        <button
          type="button"
          onClick={() => (view === "month" ? shiftMonth(1) : setYear(year + 1))}
          aria-label="Næste"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[8px] bg-bg-elevated text-mid hover:text-ink sm:size-7 md:bg-bg"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {view === "month" ? (
        <MetricMonthGrid
          year={year}
          month={month}
          metric={metric}
          hits={hits}
          minVal={minVal}
          maxVal={maxVal}
          exerciseDates={exerciseDates}
          sleepScores={sleepScores}
          garminSleepEnabled={garminSleepEnabled}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CAL_MONTHS_SHORT.map((label, m) => {
            const prefix = `${year}-${calPad(m + 1)}`;
            const count = [...hits.keys()].filter((d) => d.startsWith(prefix)).length;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMonth(m);
                  setView("month");
                }}
                title={`Vis ${CAL_MONTHS[m]} ${year}`}
                className="cursor-pointer rounded-[8px] bg-bg-elevated p-2 text-left transition-colors hover:bg-bg-subtle md:bg-bg"
              >
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-mid">{label}</span>
                  <span className="text-[10px] text-light">
                    {count > 0 ? count : ""}
                  </span>
                </div>
                <MetricMiniMonth
                  year={year}
                  month={m}
                  metric={metric}
                  hits={hits}
                  minVal={minVal}
                  maxVal={maxVal}
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MetricMonthGrid({
  year,
  month,
  metric,
  hits,
  minVal,
  maxVal,
  exerciseDates,
  sleepScores,
  garminSleepEnabled,
}: {
  year: number;
  month: number;
  metric: Metric;
  hits: Map<string, number>;
  minVal: number;
  maxVal: number;
  exerciseDates: Set<string>;
  sleepScores: Map<string, number>;
  garminSleepEnabled: boolean;
}) {
  const cells: (string | null)[] = [];
  for (let i = 0; i < calFirstWeekday(year, month); i++) cells.push(null);
  for (let d = 1; d <= calDaysInMonth(year, month); d++) {
    cells.push(calIso(year, month, d));
  }
  const today = toIsoDate(new Date());

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {CAL_WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] uppercase tracking-[0.5px] text-dim"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="aspect-square" />;
          const value = hits.get(iso);
          const hit = value !== undefined;
          const isToday = iso === today;
          const score = garminSleepEnabled ? sleepScores.get(iso) : undefined;
          const isBool = metric.domain !== undefined && metric.domain[0] === 0;
          const showValue = hit && !isBool;
          return (
            <div
              key={iso}
              title={
                hit
                  ? isBool
                    ? danishLongDate(iso)
                    : `${danishLongDate(iso)}: ${value!.toFixed(metric.decimals).replace(".", ",")}${metric.unit}`
                  : undefined
              }
              className={`relative flex aspect-square min-h-[44px] flex-col rounded-[8px] border p-1 text-left md:p-1.5 ${
                isToday
                  ? "border-accent bg-bg-elevated md:bg-bg"
                  : "border-transparent bg-bg-elevated md:bg-bg"
              }`}
              style={
                hit
                  ? {
                      backgroundColor: withAlpha(
                        metric.color,
                        heatAlpha(metric, value!, minVal, maxVal),
                      ),
                    }
                  : undefined
              }
            >
              <span
                className={`text-[13px] ${
                  isToday ? "font-semibold text-accent" : "font-medium text-ink"
                }`}
              >
                {Number(iso.slice(8))}
              </span>
              {/* Badge + værdi skjules under sm: — på små skærme er cellerne
                  for trange, og heat-farven + tælleren bærer informationen. */}
              {score !== undefined && (
                <span
                  className={`absolute right-1 top-1 hidden rounded-[3px] px-1 py-[1px] text-[9px] font-semibold sm:block ${calScoreClasses(score)}`}
                  title={`Garmin søvnscore: ${score}`}
                >
                  {score}
                </span>
              )}
              {exerciseDates.has(iso) && (
                <Dumbbell
                  className="absolute bottom-1 left-1 size-[11px] text-accent opacity-85"
                  strokeWidth={2.5}
                />
              )}
              {showValue && (
                <span className="absolute bottom-1 right-1 hidden text-[9px] font-medium text-ink/80 sm:block">
                  {value!.toFixed(metric.decimals).replace(".", ",")}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-hair pt-3.5 text-[11px] text-light">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-[3px]"
            style={{ backgroundColor: withAlpha(metric.color, 0.55) }}
          />
          {metric.label}
          {!(metric.domain && metric.domain[0] === 0) && " — mørkere = højere"}
        </span>
        {garminSleepEnabled && (
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="rounded-[3px] bg-[var(--success-soft)] px-1.5 py-[1px] text-[10px] font-semibold text-success">
              82
            </span>
            Garmin søvnscore
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Dumbbell className="size-[11px] text-accent opacity-85" strokeWidth={2.5} />
          Træning
        </span>
      </div>
    </div>
  );
}

function MetricMiniMonth({
  year,
  month,
  metric,
  hits,
  minVal,
  maxVal,
}: {
  year: number;
  month: number;
  metric: Metric;
  hits: Map<string, number>;
  minVal: number;
  maxVal: number;
}) {
  const cells: (string | null)[] = [];
  for (let i = 0; i < calFirstWeekday(year, month); i++) cells.push(null);
  for (let d = 1; d <= calDaysInMonth(year, month); d++) {
    cells.push(calIso(year, month, d));
  }
  const today = toIsoDate(new Date());
  return (
    <div className="grid grid-cols-7 gap-[3px]">
      {cells.map((iso, i) => {
        if (iso === null) return <div key={i} className="aspect-square" />;
        const value = hits.get(iso);
        return (
          <div
            key={iso}
            title={
              value !== undefined
                ? `${danishLongDate(iso)}: ${value.toFixed(metric.decimals).replace(".", ",")}${metric.unit}`
                : undefined
            }
            className="aspect-square rounded-[2px]"
            style={{
              backgroundColor:
                value !== undefined
                  ? withAlpha(
                      metric.color,
                      // Mini-cellerne er små — løft intensiteten lidt så
                      // svage værdier stadig kan ses.
                      Math.min(1, heatAlpha(metric, value, minVal, maxVal) + 0.2),
                    )
                  : "var(--bg-subtle)",
              ...(iso === today
                ? { boxShadow: "inset 0 0 0 1.5px var(--accent)" }
                : undefined),
            }}
          />
        );
      })}
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hair pb-2">
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
          className="md:rounded-[10px] md:bg-bg-elevated md:p-5 md:shadow-[var(--shadow-card)]"
        >
          <MetricHeader metric={m} data={data} />
          <div className="mt-2 h-[160px] w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
              initialDimension={{ width: 600, height: 160 }}
            >
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
    <div className="md:rounded-[10px] md:bg-bg-elevated md:p-5 md:shadow-[var(--shadow-card)]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-hair pb-2">
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
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 600, height: 460 }}
        >
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
    <div className="rounded-[8px] bg-bg-elevated/95 px-3 py-2 text-[11px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] backdrop-blur">
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
