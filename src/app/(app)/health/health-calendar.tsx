"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import {
  Activity,
  Apple,
  Camera,
  ChevronLeft,
  ChevronRight,
  Moon,
  Pencil,
  Scale,
  Smile,
  Sparkles,
  Upload,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import { saveDayEntry } from "../today/actions";
import { importGarminSleepCsv, deleteSleepEntry } from "./actions";
import { TrackerPhotoSection } from "@/components/tracker-photo-section";
import { CustomParametersSection } from "@/components/custom-parameters-section";
import {
  listCustomValuesForDate,
  type CustomParamSummary,
  type CustomValueRow,
} from "@/lib/custom-parameters";
import { danishLongDate, danishWeekday, todayIsoDate } from "@/lib/date";
import { garminScoreToQuality } from "@/lib/sleep";
import { SleepQualityScale } from "@/components/sleep-quality-scale";

type Sleep = {
  date: string;
  durationMin: number | null;
  score: number | null;
  qualityLabel: string | null;
  deepMin: number | null;
  lightMin: number | null;
  remMin: number | null;
  awakeMin: number | null;
  avgStress: number | null;
  avgHeartRate: number | null;
  restingHeartRate: number | null;
  bodyBatteryChange: number | null;
  avgSpO2: number | null;
  lowestSpO2: number | null;
  avgBreathingX10: number | null;
  hrvMs: number | null;
  hrv7dStatus: string | null;
};

type Entry = {
  date: string;
  mood: number | null;
  energy: number | null;
  sleepHoursX10: number | null;
  sleepQuality: number | null;
  alcoholUnits: number | null;
  didExercise: boolean;
  exerciseIntensity: "light" | "medium" | "hard" | null;
  didFast: boolean;
  fastHoursX10: number | null;
  fastBreakTime: string | null;
  weightX10: number | null;
  waistX10: number | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  healthNotes: string;
  workNotes: string;
  dayNotes: string;
  wentWell: string;
  nextStep: string;
};

type TrackerRef = { id: number; name: string; kind: string };

const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];
const WEEKDAYS_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoOf(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function firstWeekday(y: number, m: number) {
  return (new Date(y, m, 1).getDay() + 6) % 7;
}
function fmtHours(x10: number | null) {
  return x10 === null ? "" : (x10 / 10).toString().replace(".", ",");
}
function parseHours(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 24) return null;
  return Math.round(n * 10);
}
function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}
function moodTone(mood: number | null): string {
  if (mood === null) return "bg-border";
  if (mood <= 2) return "bg-danger";
  if (mood === 3) return "bg-warning";
  return "bg-success";
}
function scoreColor(score: number | null): string {
  if (score === null) return "text-mid";
  if (score >= 80) return "bg-[rgba(74,222,128,0.15)] text-success";
  if (score >= 60) return "bg-[rgba(251,191,36,0.15)] text-warning";
  return "bg-[rgba(248,113,113,0.15)] text-danger";
}
function fmtMinutes(m: number | null): string {
  if (m === null) return "–";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return `${h}t ${pad(r)}m`;
}

export function HealthCalendar({
  entries: initial,
  sleepEntries: initialSleep,
  trackers,
  customParameters,
  garminSleepEnabled,
}: {
  entries: Entry[];
  sleepEntries: Sleep[];
  trackers: TrackerRef[];
  customParameters: CustomParamSummary[];
  garminSleepEnabled: boolean;
}) {
  const today = todayIsoDate();
  const [entries, setEntries] = useState<Map<string, Entry>>(
    () => new Map(initial.map((e) => [e.date, e])),
  );
  const [sleeps, setSleeps] = useState<Map<string, Sleep>>(
    () => new Map(initialSleep.map((s) => [s.date, s])),
  );
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string>(today);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Build cells for current month (Mon-indexed grid)
  const cells = useMemo<(string | null)[]>(() => {
    const arr: (string | null)[] = [];
    const start = firstWeekday(year, month);
    for (let i = 0; i < start; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      arr.push(isoOf(year, month, d));
    }
    return arr;
  }, [year, month]);

  const monthEntries = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}`;
    return [...entries.values()].filter((e) => e.date.startsWith(prefix));
  }, [entries, year, month]);

  const summary = useMemo(() => {
    const logged = monthEntries.length;
    const training = monthEntries.filter((e) => e.didExercise).length;
    const alcohol = monthEntries.filter(
      (e) => e.alcoholUnits !== null && e.alcoholUnits > 0,
    ).length;
    // Søvn-snit: brug Garmin-varighed hvis tilgængelig, ellers manuel sleepHours
    const prefix = `${year}-${pad(month + 1)}`;
    const sleepHours: number[] = [];
    for (const e of monthEntries) {
      const garmin = sleeps.get(e.date);
      if (garmin?.durationMin != null) {
        sleepHours.push(garmin.durationMin / 60);
      } else if (e.sleepHoursX10 !== null) {
        sleepHours.push(e.sleepHoursX10 / 10);
      }
    }
    // Også tag Garmin-dage MED hvis der ikke er nogen dayEntry for dagen
    for (const [date, s] of sleeps) {
      if (!date.startsWith(prefix)) continue;
      if (s.durationMin == null) continue;
      if (entries.has(date)) continue; // allerede talt med ovenfor
      sleepHours.push(s.durationMin / 60);
    }
    const sleepAvg = avg(sleepHours);
    const drinks = monthEntries.reduce(
      (sum, e) => sum + (e.alcoholUnits ?? 0),
      0,
    );

    // Vægt-trend: nyeste vs. tidligere i måneden
    const weightEntries = monthEntries
      .filter((e) => e.weightX10 !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    let weightLatest: number | null = null;
    let weightDelta: number | null = null;
    if (weightEntries.length > 0) {
      weightLatest = weightEntries[weightEntries.length - 1].weightX10! / 10;
      if (weightEntries.length >= 2) {
        weightDelta =
          weightLatest - weightEntries[0].weightX10! / 10;
      }
    }

    // Livvidde: seneste måling i måneden
    const waistEntries = monthEntries
      .filter((e) => e.waistX10 !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const waistLatest =
      waistEntries.length > 0
        ? waistEntries[waistEntries.length - 1].waistX10! / 10
        : null;

    const daysInMonthCount = daysInMonth(year, month);

    return {
      logged,
      loggedTotal: daysInMonthCount,
      training,
      drinks,
      sleep: sleepAvg,
      weightLatest,
      weightDelta,
      waistLatest,
    };
  }, [monthEntries, year, month, sleeps, entries]);

  function handleEntrySaved(date: string, next: Entry) {
    setEntries((prev) => {
      const m = new Map(prev);
      m.set(date, next);
      return m;
    });
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:py-8">
      <PageHead
        month={month}
        year={year}
        onShift={shift}
        garminSleepEnabled={garminSleepEnabled}
        onImported={(s) =>
          setSleeps((m) => {
            const next = new Map(m);
            next.set(s.date, s);
            return next;
          })
        }
      />

      <StatRow summary={summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <CalendarPane
          cells={cells}
          entries={entries}
          sleeps={sleeps}
          selected={selected}
          today={today}
          onSelect={setSelected}
        />

        <DayEditorPanel
          key={selected}
          date={selected}
          entry={entries.get(selected)}
          sleep={sleeps.get(selected)}
          trackers={trackers}
          customParameters={customParameters}
          garminSleepEnabled={garminSleepEnabled}
          onSaved={(e) => handleEntrySaved(selected, e)}
          onSleepDeleted={() =>
            setSleeps((m) => {
              const next = new Map(m);
              next.delete(selected);
              return next;
            })
          }
          onImported={(s) =>
            setSleeps((m) => {
              const next = new Map(m);
              next.set(s.date, s);
              return next;
            })
          }
        />
      </div>
    </div>
  );
}

// --- PAGE HEAD -------------------------------------------------------------

function PageHead({
  month,
  year,
  onShift,
}: {
  month: number;
  year: number;
  onShift: (delta: number) => void;
  onImported: (s: Sleep) => void;
  garminSleepEnabled: boolean;
}) {
  const monthShort = MONTHS[month].slice(0, 3);
  return (
    <header className="mb-6 flex items-end justify-between gap-3 border-b border-hair pb-5">
      <div className="min-w-0">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
          Helbred
        </div>
        <h1 className="whitespace-nowrap font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
          {capitalize(MONTHS[month])} {year}
        </h1>
      </div>
      <div className="inline-flex shrink-0 items-center rounded-full bg-bg-elevated p-1">
        <button
          type="button"
          onClick={() => onShift(-1)}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-mid hover:bg-bg-subtle hover:text-ink"
          aria-label="Forrige måned"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 text-[12px] font-medium text-ink">
          {monthShort}
        </span>
        <button
          type="button"
          onClick={() => onShift(1)}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-mid hover:bg-bg-subtle hover:text-ink"
          aria-label="Næste måned"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </header>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- STAT ROW --------------------------------------------------------------

function StatRow({
  summary,
}: {
  summary: {
    logged: number;
    loggedTotal: number;
    training: number;
    drinks: number;
    sleep: number | null;
    weightLatest: number | null;
    weightDelta: number | null;
    waistLatest: number | null;
  };
}) {
  return (
    <div className="mb-6 -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-6">
      <StatCard label="Logget" value={String(summary.logged)} unit={`/${summary.loggedTotal}`} />
      <StatCard
        label="Søvn Ø"
        value={summary.sleep !== null ? summary.sleep.toFixed(1).replace(".", ",") : "–"}
        unit={summary.sleep !== null ? "t" : undefined}
      />
      <StatCard label="Træning" value={String(summary.training)} unit=" dage" />
      <StatCard
        label="Vægt"
        value={
          summary.weightLatest !== null
            ? summary.weightLatest.toFixed(1).replace(".", ",")
            : "–"
        }
        unit={summary.weightLatest !== null ? "kg" : undefined}
        trend={
          summary.weightLatest !== null && summary.weightDelta !== null && summary.weightDelta !== 0
            ? {
                value: `${summary.weightDelta < 0 ? "↓" : "↑"} ${Math.abs(summary.weightDelta).toFixed(1).replace(".", ",")}`,
                positive: summary.weightDelta < 0,
              }
            : undefined
        }
      />
      <StatCard
        label="Livvidde"
        value={
          summary.waistLatest !== null
            ? summary.waistLatest.toFixed(1).replace(".", ",")
            : "–"
        }
        unit={summary.waistLatest !== null ? "cm" : undefined}
      />
      <StatCard label="Genstande" value={String(summary.drinks)} unit="stk" />
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="min-w-[100px] shrink-0 rounded-[10px] bg-bg-elevated px-3.5 py-3 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] sm:min-w-0 sm:shrink">
      <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        {label}
      </div>
      <div className="mt-1 font-serif text-[20px] leading-[1.1] text-ink sm:text-[22px]">
        {value}
        {unit && <span className="text-[12px] text-light">{unit}</span>}
        {trend && (
          <span
            className={`ml-1.5 text-[11px] ${trend.positive ? "text-success" : "text-warning"}`}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}


// --- CALENDAR --------------------------------------------------------------

function CalendarPane({
  cells,
  entries,
  sleeps,
  selected,
  today,
  onSelect,
}: {
  cells: (string | null)[];
  entries: Map<string, Entry>;
  sleeps: Map<string, Sleep>;
  selected: string;
  today: string;
  onSelect: (iso: string) => void;
}) {
  return (
    <div className="md:rounded-md md:border md:border-border md:bg-card md:p-3">
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((w) => (
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
          const e = entries.get(iso);
          const sleep = sleeps.get(iso);
          const day = Number(iso.slice(8));
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={`relative flex aspect-square min-h-[44px] cursor-pointer flex-col rounded-[4px] border p-1 text-left transition ${
                isSelected
                  ? "border-accent bg-accent-bg"
                  : isToday
                    ? "border-accent-dim bg-bg"
                    : "border-border-light bg-bg hover:border-accent-dim"
              }`}
            >
              <span
                className={`text-[11px] font-medium ${
                  isToday ? "text-accent-bright" : "text-mid"
                }`}
              >
                {day}
              </span>
              {sleep?.score !== null && sleep?.score !== undefined && (
                <span
                  className={`absolute right-1 top-1 rounded-[2px] px-1 text-[9px] font-medium ${scoreColor(sleep.score)}`}
                  title={`Garmin: ${sleep.score}`}
                >
                  {sleep.score}
                </span>
              )}
              <div className="mt-auto flex items-end justify-between gap-1">
                {e?.didExercise && (
                  <span
                    className="size-1.5 rounded-full bg-success"
                    title="Træning"
                  />
                )}
              </div>
              {e?.mood !== null && e?.mood !== undefined && (
                <div className={`mt-1 h-0.5 rounded-full ${moodTone(e.mood)}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border-light pt-3 text-[10px] text-dim">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-success" />
          Godt humør
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-warning" />
          Neutralt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-danger" />
          Lavt humør
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-[2px] bg-[rgba(74,222,128,0.15)] px-1 text-[9px] text-success">
            82
          </span>
          Garmin-score
        </span>
      </div>
    </div>
  );
}

// --- DAY EDITOR PANEL ------------------------------------------------------

function DayEditorPanel({
  date,
  entry,
  sleep,
  trackers,
  customParameters,
  garminSleepEnabled,
  onSaved,
  onSleepDeleted,
  onImported,
}: {
  date: string;
  entry?: Entry;
  sleep?: Sleep;
  trackers: TrackerRef[];
  customParameters: CustomParamSummary[];
  garminSleepEnabled: boolean;
  onSaved: (e: Entry) => void;
  onSleepDeleted: () => void;
  onImported: (s: Sleep) => void;
}) {
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(entry?.energy ?? null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(
    entry?.sleepQuality ?? null,
  );
  const [alcoholUnits, setAlcoholUnits] = useState<number | null>(
    entry?.alcoholUnits ?? null,
  );
  const [didExercise, setDidExercise] = useState(entry?.didExercise ?? false);
  const [exerciseIntensity, setExerciseIntensity] = useState<
    "light" | "medium" | "hard" | null
  >(entry?.exerciseIntensity ?? null);
  const [weightInput, setWeightInput] = useState(
    entry?.weightX10 === null || entry?.weightX10 === undefined
      ? ""
      : (entry.weightX10 / 10).toString().replace(".", ","),
  );
  const [waistInput, setWaistInput] = useState(
    entry?.waistX10 === null || entry?.waistX10 === undefined
      ? ""
      : (entry.waistX10 / 10).toString().replace(".", ","),
  );
  const [carbsG, setCarbsG] = useState<number | null>(entry?.carbsG ?? null);
  const [proteinG, setProteinG] = useState<number | null>(
    entry?.proteinG ?? null,
  );
  const [fatG, setFatG] = useState<number | null>(entry?.fatG ?? null);
  const [sleepInput, setSleepInput] = useState(
    fmtHours(entry?.sleepHoursX10 ?? null),
  );
  const [healthNotes, setHealthNotes] = useState(entry?.healthNotes ?? "");

  const [customValues, setCustomValues] = useState<CustomValueRow[]>([]);
  const [customValuesReady, setCustomValuesReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCustomValuesReady(false);
    listCustomValuesForDate(date).then((vals) => {
      if (cancelled) return;
      setCustomValues(vals);
      setCustomValuesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  // Auto-save state
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [, startSave] = useTransition();
  const isFirstRender = useRef(true);
  const errorMsg = useRef<string | null>(null);

  function buildPayload() {
    return {
      date,
      mood,
      energy,
      sleepHoursX10: parseHours(sleepInput),
      sleepQuality,
      alcoholUnits,
      didExercise,
      exerciseIntensity: didExercise ? exerciseIntensity : null,
      didFast: entry?.didFast ?? false,
      fastHoursX10: entry?.fastHoursX10 ?? null,
      fastBreakTime: entry?.fastBreakTime ?? null,
      weightX10: parseDecX10(weightInput, 500),
      waistX10: parseDecX10(waistInput, 300),
      carbsG,
      proteinG,
      fatG,
      healthNotes: healthNotes.trim() || null,
      workNotes: entry?.workNotes || null,
      dayNotes: entry?.dayNotes || null,
      wentWell: entry?.wentWell || null,
      nextStep: entry?.nextStep || null,
    };
  }

  // Auto-save: debounced effect that fires whenever any input changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveState("saving");
    const handle = setTimeout(() => {
      startSave(async () => {
        const payload = buildPayload();
        const res = await saveDayEntry(payload);
        if (res.ok) {
          setSaveState("saved");
          setSavedAt(new Date());
          errorMsg.current = null;
          onSaved({
            date,
            mood,
            energy,
            sleepHoursX10: payload.sleepHoursX10,
            sleepQuality,
            alcoholUnits,
            didExercise,
            exerciseIntensity: didExercise ? exerciseIntensity : null,
            didFast: entry?.didFast ?? false,
            fastHoursX10: entry?.fastHoursX10 ?? null,
            fastBreakTime: entry?.fastBreakTime ?? null,
            weightX10: payload.weightX10,
            waistX10: payload.waistX10,
            carbsG,
            proteinG,
            fatG,
            healthNotes,
            workNotes: entry?.workNotes ?? "",
            dayNotes: entry?.dayNotes ?? "",
            wentWell: entry?.wentWell ?? "",
            nextStep: entry?.nextStep ?? "",
          });
        } else {
          setSaveState("error");
          errorMsg.current = res.error;
        }
      });
    }, 800);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mood, energy, sleepInput, sleepQuality, alcoholUnits, didExercise,
    exerciseIntensity, weightInput, waistInput, carbsG, proteinG, fatG, healthNotes,
  ]);

  const hasGarminScore =
    garminSleepEnabled && sleep?.score !== null && sleep?.score !== undefined;
  const hasGarminDuration =
    garminSleepEnabled &&
    sleep?.durationMin !== null &&
    sleep?.durationMin !== undefined;

  const kcal =
    carbsG !== null && proteinG !== null && fatG !== null
      ? carbsG * 4 + proteinG * 4 + fatG * 9
      : null;

  return (
    <aside className="md:rounded-md md:border md:border-border md:bg-card md:p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] lg:overflow-y-auto">
      <EditorHead date={date} saveState={saveState} savedAt={savedAt} errorMsg={errorMsg.current} />

      {(hasGarminScore || hasGarminDuration) && (
        <GarminBanner sleep={sleep!} onDelete={onSleepDeleted} />
      )}

      <Section icon={<Moon className="size-3.5" />} title="Søvn">
        <Field label="Varighed" hint={hasGarminDuration ? "Garmin" : undefined}>
          {hasGarminDuration ? (
            <span className="text-[13px] text-mid">
              {fmtMinutes(sleep!.durationMin)}
            </span>
          ) : (
            <NumberInput
              value={sleepInput}
              onChange={setSleepInput}
              unit="t"
              placeholder="Fx 7,5"
            />
          )}
        </Field>
        {garminSleepEnabled ? (
          <Field label="Søvnscore" hint="Garmin">
            {hasGarminScore ? (
              <span className="text-[13px] font-medium text-ink">
                {sleep!.score}
                <span className="ml-0.5 text-[11px] text-dim">/100</span>
              </span>
            ) : (
              <span className="text-[12px] italic text-dim">
                Importér CSV
              </span>
            )}
          </Field>
        ) : (
          <Field label="Kvalitet">
            <SleepQualityScale
              value={sleepQuality}
              onChange={setSleepQuality}
            />
          </Field>
        )}
        {garminSleepEnabled && (
          <div className="pt-2">
            <SleepImport onImported={onImported} compact />
          </div>
        )}
      </Section>

      <Section icon={<Smile className="size-3.5" />} title="Stemning">
        <Field label="Humør">
          <Scale1to5 value={mood} onChange={setMood} />
        </Field>
        <Field label="Energi">
          <Scale1to5 value={energy} onChange={setEnergy} />
        </Field>
      </Section>

      <Section icon={<Scale className="size-3.5" />} title="Krop">
        <div className="grid grid-cols-2 gap-3">
          <GridField label="Vægt">
            <NumberInput
              fluid
              value={weightInput}
              onChange={setWeightInput}
              unit="kg"
              placeholder="78,5"
            />
          </GridField>
          <GridField label="Livvidde">
            <NumberInput
              fluid
              value={waistInput}
              onChange={setWaistInput}
              unit="cm"
              placeholder="89,5"
            />
          </GridField>
        </div>
      </Section>

      <Section
        icon={<Apple className="size-3.5" />}
        title="Ernæring"
        meta={kcal !== null ? `${kcal} kcal` : undefined}
      >
        <div className="grid grid-cols-3 gap-3">
          <GridField label="Kulhydrat">
            <NumberInput
              fluid
              value={carbsG === null ? "" : String(carbsG)}
              onChange={(v) => setCarbsG(parseInt0to2000(v))}
              unit="g"
              placeholder="0"
            />
          </GridField>
          <GridField label="Protein">
            <NumberInput
              fluid
              value={proteinG === null ? "" : String(proteinG)}
              onChange={(v) => setProteinG(parseInt0to1000(v))}
              unit="g"
              placeholder="0"
            />
          </GridField>
          <GridField label="Fedt">
            <NumberInput
              fluid
              value={fatG === null ? "" : String(fatG)}
              onChange={(v) => setFatG(parseInt0to1000(v))}
              unit="g"
              placeholder="0"
            />
          </GridField>
        </div>
      </Section>

      <Section icon={<Activity className="size-3.5" />} title="Aktivitet">
        <Field label="Træning">
          <YesNo
            value={didExercise}
            onChange={(v) => {
              setDidExercise(v);
              if (!v) setExerciseIntensity(null);
            }}
          />
        </Field>
        {didExercise && (
          <Field label="Intensitet" indent>
            <IntensityPicker
              value={exerciseIntensity}
              onChange={setExerciseIntensity}
            />
          </Field>
        )}
        <Field label="Alkohol">
          <NumberInput
            value={alcoholUnits === null ? "" : String(alcoholUnits)}
            onChange={(v) => setAlcoholUnits(parseInt0to50(v))}
            unit="×"
            placeholder="0"
          />
        </Field>
      </Section>

      {customParameters.length > 0 && customValuesReady && (
        <Section
          icon={<Sparkles className="size-3.5" />}
          title="Mine parametre"
        >
          <CustomParametersSection
            date={date}
            parameters={customParameters}
            initialValues={customValues}
          />
        </Section>
      )}

      <Section icon={<Pencil className="size-3.5" />} title="Helbredsnoter">
        <textarea
          value={healthNotes}
          onChange={(e) => setHealthNotes(e.target.value)}
          rows={3}
          placeholder="Symptomer, medicin, observationer..."
          className="!text-[13px]"
        />
      </Section>

      <Section icon={<Camera className="size-3.5" />} title="Fotos">
        <TrackerPhotoSection date={date} trackers={trackers} />
      </Section>
    </aside>
  );
}

// --- EDITOR SUB-COMPONENTS --------------------------------------------------

function EditorHead({
  date,
  saveState,
  savedAt,
  errorMsg,
}: {
  date: string;
  saveState: "idle" | "saving" | "saved" | "error";
  savedAt: Date | null;
  errorMsg: string | null;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-border-light pb-2.5">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.5px] text-light">
          {danishWeekday(date)}
        </div>
        <div className="font-serif text-[22px] text-ink">
          {danishLongDate(date)}
        </div>
      </div>
      <SaveIndicator state={saveState} savedAt={savedAt} errorMsg={errorMsg} />
    </div>
  );
}

function SaveIndicator({
  state,
  savedAt,
  errorMsg,
}: {
  state: "idle" | "saving" | "saved" | "error";
  savedAt: Date | null;
  errorMsg: string | null;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] italic text-light">
        <Loader2 className="size-3 animate-spin" />
        Gemmer…
      </span>
    );
  }
  if (state === "saved" && savedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] italic text-success">
        <Check className="size-3" />
        Gemt {pad(savedAt.getHours())}:{pad(savedAt.getMinutes())}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-[11px] italic text-danger" title={errorMsg ?? ""}>
        Fejl – ikke gemt
      </span>
    );
  }
  return null;
}

function Section({
  icon,
  title,
  meta,
  aiPill,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  aiPill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 border-b border-hair pb-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-light">
        <span className="text-mid">{icon}</span>
        <span>{title}</span>
        {aiPill && (
          <span className="ml-auto rounded-full bg-accent-bg px-1.5 py-0.5 text-[8px] font-normal tracking-[0.3px] text-accent-bright">
            AI
          </span>
        )}
        {meta && (
          <span className="ml-auto text-[10px] font-normal text-accent">
            {meta}
          </span>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  indent,
  children,
}: {
  label: string;
  hint?: string;
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1 ${indent ? "ml-3" : ""}`}
    >
      <span className="text-[13px] text-ink">
        {label}
        {hint && (
          <span className="ml-1.5 rounded-[2px] bg-accent-bg px-1 py-0.5 text-[9px] uppercase tracking-[0.3px] text-accent-bright">
            {hint}
          </span>
        )}
      </span>
      <div>{children}</div>
    </div>
  );
}

function Scale1to5({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? null : n)}
            className={`min-h-[28px] min-w-[28px] cursor-pointer rounded-[3px] border text-[11px] transition ${
              active
                ? "border-accent bg-accent-bg text-accent-bright"
                : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[
        { label: "Ja", v: true, cls: "yes" },
        { label: "Nej", v: false, cls: "no" },
      ].map(({ label, v, cls }) => {
        const active = value === v;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(v)}
            className={`min-h-[28px] min-w-[44px] cursor-pointer rounded-[3px] border px-2 text-[11px] transition ${
              active
                ? cls === "yes"
                  ? "border-success bg-[rgba(74,222,128,0.12)] text-success"
                  : "border-mid text-ink"
                : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function IntensityPicker({
  value,
  onChange,
}: {
  value: "light" | "medium" | "hard" | null;
  onChange: (v: "light" | "medium" | "hard" | null) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {(
        [
          { v: "light", label: "Let" },
          { v: "medium", label: "Mellem" },
          { v: "hard", label: "Hård" },
        ] as const
      ).map(({ v, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(active ? null : v)}
            className={`min-h-[28px] cursor-pointer rounded-[3px] border px-2 text-[11px] transition ${
              active
                ? "border-accent bg-accent-bg text-accent-bright"
                : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  unit,
  placeholder,
  fluid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder: string;
  fluid?: boolean;
}) {
  return (
    <div className={fluid ? "relative w-full" : "relative w-[110px]"}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="!text-[16px] sm:!text-[12px]"
        style={{ paddingRight: "32px", paddingTop: "5px", paddingBottom: "5px" }}
      />
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-dim"
      >
        {unit}
      </span>
    </div>
  );
}

function GridField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        {label}
      </div>
      {children}
    </div>
  );
}

function GarminBanner({
  sleep,
  onDelete,
}: {
  sleep: Sleep;
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  function del() {
    if (!confirm("Slet Garmin-søvndata for denne dag?")) return;
    start(async () => {
      const dateAttr = (sleep as Sleep).date;
      await deleteSleepEntry(dateAttr);
      onDelete();
    });
  }
  return (
    <div className="mb-3 flex items-center gap-2 rounded-[4px] border border-[rgba(74,144,226,0.2)] bg-gradient-to-r from-accent-bg to-transparent px-3 py-2 text-[12px] text-mid">
      <Moon className="size-3.5 text-accent-bright" />
      <span>
        <strong className="font-medium text-ink">Garmin søvn</strong>
        {sleep.durationMin !== null && (
          <> · {fmtMinutes(sleep.durationMin)}</>
        )}
        {sleep.qualityLabel && <> · {sleep.qualityLabel.toLowerCase()}</>}
      </span>
      {sleep.score !== null && (
        <span
          className={`ml-auto rounded-[3px] px-2 py-0.5 text-[11px] font-semibold ${scoreColor(sleep.score)}`}
        >
          {sleep.score}
        </span>
      )}
      <button
        type="button"
        onClick={del}
        disabled={pending}
        className="ml-1 cursor-pointer text-dim hover:text-danger"
        title="Slet Garmin-data"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

// --- SLEEP IMPORT (button in PageHead) ------------------------------------

function SleepImport({
  onImported,
  compact = false,
}: {
  onImported: (s: Sleep) => void;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMsg(null);
    start(async () => {
      let created = 0,
        updated = 0,
        errors = 0;
      for (const f of Array.from(files)) {
        const text = await f.text();
        const res = await importGarminSleepCsv({ csvText: text, filename: f.name });
        if (res.ok) {
          if (res.action === "created") created++;
          else updated++;
          onImported({
            date: res.date,
            durationMin: null,
            score: null,
            qualityLabel: null,
            deepMin: null,
            lightMin: null,
            remMin: null,
            awakeMin: null,
            avgStress: null,
            avgHeartRate: null,
            restingHeartRate: null,
            bodyBatteryChange: null,
            avgSpO2: null,
            lowestSpO2: null,
            avgBreathingX10: null,
            hrvMs: null,
            hrv7dStatus: null,
          });
        } else {
          errors++;
        }
      }
      const parts: string[] = [];
      if (created) parts.push(`${created} ny`);
      if (updated) parts.push(`${updated} opdateret`);
      if (errors) parts.push(`${errors} fejl`);
      setMsg(parts.join(", "));
      setTimeout(() => setMsg(null), 4000);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        onChange={(e) => onFiles(e.target.files)}
        className="hidden"
      />
      {compact ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-accent hover:underline disabled:opacity-50"
          title={msg ?? "Importér søvndata (Garmin CSV)"}
        >
          <Upload className="size-3" />
          {pending ? "Importerer…" : msg ?? "Importér søvndata"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-[8px] bg-bg-elevated px-3 py-1.5 text-[12px] text-mid hover:bg-bg-subtle hover:text-ink disabled:opacity-50"
          title={msg ?? "Importér søvndata (Garmin CSV)"}
        >
          <Upload className="size-3.5" />
          {pending ? "Importerer…" : msg ?? "Importér søvndata"}
        </button>
      )}
    </>
  );
}

// --- helpers --------------------------------------------------------------

function parseDecX10(s: string, max: number): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 10);
}
function parseInt0to2000(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 2000) return null;
  return Math.floor(n);
}
function parseInt0to1000(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return Math.floor(n);
}
function parseInt0to50(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 50) return null;
  return Math.floor(n);
}
