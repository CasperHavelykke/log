"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EscapeButton } from "./cholesterol-shell";
import type { CholesterolData, DayPoint } from "./data";
import { formatDanishDate } from "@/lib/date";

const fmtInt = (n: number) => n.toLocaleString("da-DK");
const fmtKg = (n: number) =>
  n.toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${m}`;
}

// ISO-ugenummer for en dato (mandag-start).
function isoWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7);
}

export function HistoryView({
  data,
  onEscape,
}: {
  data: CholesterolData;
  onEscape: () => void;
}) {
  const { days, weeks } = data.history;
  const satMax = data.targets?.saturatedFat.max ?? null;
  const kcalMin = data.targets?.kcal.min ?? null;
  const kcalMax = data.targets?.kcal.max ?? null;

  const hasSat = days.some((d) => d.saturatedFat !== null);
  const hasKcal = days.some((d) => d.kcal !== null);
  const hasWeight = days.some((d) => d.weight !== null);
  const satOver = satMax !== null && days.some((d) => d.saturatedFat !== null && d.saturatedFat > satMax);
  const kcalOver = kcalMax !== null && days.some((d) => d.kcal !== null && d.kcal > kcalMax);

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] text-mid">Sidste 4 uger</div>
          <h1 className="font-serif text-[28px] leading-tight text-ink">Historik</h1>
        </div>
        <EscapeButton onClick={onEscape} />
      </header>

      <Card
        title="Mættet fedt pr. dag"
        subtitle={satMax !== null ? `Loft ${fmtInt(satMax)} g` : "Intet loft sat"}
        caption={satOver ? "Gule søjler er over loftet." : undefined}
      >
        {hasSat ? (
          <DayBars days={days} dataKey="saturatedFat" unit=" g" max={satMax} />
        ) : (
          <Empty />
        )}
      </Card>

      <Card
        title="Kalorier pr. dag"
        subtitle={
          kcalMin !== null && kcalMax !== null
            ? `Vedligehold ${fmtInt(kcalMin)}–${fmtInt(kcalMax)}`
            : kcalMax !== null
              ? `Loft ${fmtInt(kcalMax)}`
              : "Intet mål sat"
        }
        caption={kcalOver ? "Gule søjler er over målet." : undefined}
      >
        {hasKcal ? (
          <DayBars days={days} dataKey="kcal" unit=" kcal" min={kcalMin} max={kcalMax} />
        ) : (
          <Empty />
        )}
      </Card>

      <Card title="Vægt" subtitle={weightSubtitle(data)}>
        {hasWeight ? <WeightLine days={days} /> : <Empty />}
      </Card>

      <Card title="Ugerne i tal">
        <ul className="divide-y divide-hair">
          {[...weeks].reverse().map((w) => (
            <li key={w.weekStart} className="flex items-baseline gap-3 py-2.5">
              <span className="w-[64px] shrink-0 text-[14px] font-semibold text-ink">
                Uge {isoWeek(w.weekStart)}
              </span>
              <span className="text-[13px] tabular-nums text-mid">
                {w.avgKcal === null ? "–" : `${fmtInt(w.avgKcal)} kcal`}
                {" · "}
                {w.avgSaturatedFatG === null ? "–" : `${fmtInt(w.avgSaturatedFatG)} g mættet`}
                {" · "}
                {w.avgWeightKg === null ? "–" : `${fmtKg(w.avgWeightKg)} kg`}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function weightSubtitle(data: CholesterolData): string {
  const { deltaKg, latestKg } = data.weight;
  if (latestKg === null) return "Ingen vejning i perioden";
  if (deltaKg === null) return `Seneste ${fmtKg(latestKg)} kg`;
  if (deltaKg === 0) return `Uændret · ${fmtKg(latestKg)} kg`;
  return `${deltaKg < 0 ? "Ned" : "Op"} ${fmtKg(Math.abs(deltaKg))} kg · nu ${fmtKg(latestKg)} kg`;
}

function Card({
  title,
  subtitle,
  caption,
  children,
}: {
  title: string;
  subtitle?: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 rounded-[12px] bg-bg-elevated p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <span className="text-[12px] text-light">{subtitle}</span>}
      </div>
      {children}
      {caption && <p className="mt-2 text-[11px] text-light">{caption}</p>}
    </section>
  );
}

function Empty() {
  return (
    <p className="py-6 text-center text-[13px] italic text-light">Ingen data endnu</p>
  );
}

type TooltipPayload = { payload?: DayPoint }[];

function DayTooltip({
  active,
  payload,
  dataKey,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  dataKey: "saturatedFat" | "kcal" | "weight";
  unit: string;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const v = p[dataKey];
  return (
    <div className="rounded-[8px] border border-hair bg-bg-elevated px-3 py-2 text-[12px] shadow-[var(--shadow-card)]">
      <div className="text-light">{formatDanishDate(p.date)}</div>
      <div className="font-semibold tabular-nums text-ink">
        {v === null ? "–" : dataKey === "weight" ? `${fmtKg(v)} kg` : `${fmtInt(v)}${unit}`}
      </div>
    </div>
  );
}

// Søjler pr. dag, mål som bånd/linje, søjler over loftet i gult.
function DayBars({
  days,
  dataKey,
  unit,
  min = null,
  max,
}: {
  days: DayPoint[];
  dataKey: "saturatedFat" | "kcal";
  unit: string;
  min?: number | null;
  max: number | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={160} initialDimension={{ width: 500, height: 160 }}>
      <BarChart data={days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke="var(--border-light)" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="var(--light)"
          fontSize={11}
          tickFormatter={shortDate}
          tickMargin={4}
          minTickGap={28}
        />
        <YAxis stroke="var(--light)" fontSize={11} width="auto" tickFormatter={(v: number) => fmtInt(v)} />
        <Tooltip
          content={<DayTooltip dataKey={dataKey} unit={unit} />}
          cursor={{ fill: "var(--hair)" }}
        />
        {min !== null && max !== null && (
          <ReferenceArea y1={min} y2={max} fill="var(--success)" fillOpacity={0.12} stroke="none" />
        )}
        {max !== null && (
          <ReferenceLine y={max} stroke="var(--warning)" strokeDasharray="4 4" strokeWidth={1} />
        )}
        <Bar dataKey={dataKey} fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          {days.map((d) => (
            <Cell
              key={d.date}
              fill={
                max !== null && d[dataKey] !== null && d[dataKey]! > max
                  ? "var(--warning)"
                  : "var(--accent)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function WeightLine({ days }: { days: DayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160} initialDimension={{ width: 500, height: 160 }}>
      <LineChart data={days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border-light)" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="var(--light)"
          fontSize={11}
          tickFormatter={shortDate}
          tickMargin={4}
          minTickGap={28}
        />
        <YAxis
          stroke="var(--light)"
          fontSize={11}
          width="auto"
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v: number) => fmtKg(v)}
        />
        <Tooltip
          content={<DayTooltip dataKey="weight" unit=" kg" />}
          cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 3" }}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--accent)", stroke: "var(--bg-elevated)", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
