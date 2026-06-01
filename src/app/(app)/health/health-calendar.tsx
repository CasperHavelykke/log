"use client";

import { useMemo, useState, useTransition } from "react";
import { saveDayEntry } from "../today/actions";
import { importGarminSleepCsv, deleteSleepEntry } from "./actions";
import { TrackerPhotoAdd } from "@/components/tracker-photo-add";
import { formatDanishDate, todayIsoDate } from "@/lib/date";
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
  headache: boolean;
  headacheIntensity: number | null;
  iskiasPain: number | null;
  alcoholUnits: number | null;
  constipation: boolean;
  constipationPain: number | null;
  seborrheicDermatitis: number | null;
  staph: number | null;
  didExercise: boolean;
  exerciseIntensity: "light" | "medium" | "hard" | null;
  didFast: boolean;
  fastHoursX10: number | null;
  fastBreakTime: string | null;
  weightX10: number | null;
  waistX10: number | null;
  breathingDifficulty: number | null;
  breathingContext: string;
  foamyUrine: boolean;
  foamyUrinePattern: "morning" | "all_day" | null;
  healthNotes: string;
  workNotes: string;
  dayNotes: string;
  wentWell: string;
  nextStep: string;
};

const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];
const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoOf(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
/** Monday-indexed weekday (0=Mon … 6=Sun) of the 1st of the month. */
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
  if (score === null) return "bg-border text-mid";
  if (score >= 80) return "bg-[rgba(74,222,128,0.18)] text-success";
  if (score >= 60) return "bg-[rgba(251,191,36,0.18)] text-warning";
  return "bg-[rgba(248,113,113,0.18)] text-danger";
}

function fmtMinutes(m: number | null): string {
  if (m === null) return "–";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return `${h}t ${String(r).padStart(2, "0")}m`;
}

export function HealthCalendar({
  entries: initial,
  sleepEntries: initialSleep,
  trackers,
}: {
  entries: Entry[];
  sleepEntries: Sleep[];
  trackers: { id: number; name: string; kind: string }[];
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
  const [selected, setSelected] = useState<string | null>(null);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
  }

  const dim = daysInMonth(year, month);
  const lead = firstWeekday(year, month);
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(isoOf(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthEntries = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}`;
    return [...entries.values()].filter((e) => e.date.startsWith(prefix));
  }, [entries, year, month]);

  const summary = useMemo(
    () => ({
      logged: monthEntries.length,
      headache: monthEntries.filter((e) => e.headache).length,
      sleep: avg(
        monthEntries.filter((e) => e.sleepHoursX10 !== null).map((e) => e.sleepHoursX10! / 10),
      ),
      mood: avg(monthEntries.filter((e) => e.mood !== null).map((e) => e.mood!)),
      energy: avg(monthEntries.filter((e) => e.energy !== null).map((e) => e.energy!)),
    }),
    [monthEntries],
  );

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-serif text-[36px] font-medium leading-none text-ink">
            Helbred
          </h1>
          <a
            href="/health/trackere"
            className="text-[13px] text-accent-bright hover:underline"
          >
            Trackere →
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="cursor-pointer rounded-[3px] border border-border bg-bg px-3 py-1.5 text-mid hover:border-accent-dim hover:text-ink"
          >
            ‹
          </button>
          <span className="min-w-[150px] text-center font-serif text-[20px] text-ink">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="cursor-pointer rounded-[3px] border border-border bg-bg px-3 py-1.5 text-mid hover:border-accent-dim hover:text-ink"
          >
            ›
          </button>
        </div>
      </header>

      <SleepImport
        onImported={(s) =>
          setSleeps((m) => {
            const next = new Map(m);
            next.set(s.date, s);
            return next;
          })
        }
      />

      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-border bg-card px-5 py-3 text-[13px]">
        <Stat label="Logget" value={`${summary.logged} dage`} />
        <Stat
          label="Hovedpine"
          value={`${summary.headache} dag${summary.headache === 1 ? "" : "e"}`}
          tone={summary.headache > 0 ? "text-danger" : undefined}
        />
        <Stat label="Søvn Ø" value={summary.sleep !== null ? `${fmtHours(summary.sleep * 10)} t` : "–"} />
        <Stat label="Humør Ø" value={summary.mood !== null ? String(summary.mood) : "–"} />
        <Stat label="Energi Ø" value={summary.energy !== null ? String(summary.energy) : "–"} />
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] uppercase tracking-[0.5px] text-light">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const e = entries.get(iso);
          const day = Number(iso.slice(8));
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(isSelected ? null : iso)}
              className={`flex aspect-square flex-col rounded-[4px] border p-1.5 text-left transition ${
                isSelected
                  ? "border-accent bg-accent-bg"
                  : isToday
                    ? "border-accent-dim bg-card"
                    : "border-border bg-card hover:border-accent-dim"
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`text-[12px] ${isToday ? "font-semibold text-accent-bright" : "text-mid"}`}
                >
                  {day}
                </span>
                {e?.headache && <span className="size-2 rounded-full bg-danger" title="Hovedpine" />}
              </div>
              <div className="mt-auto space-y-1">
                {(() => {
                  const sleep = sleeps.get(iso);
                  if (sleep?.score !== null && sleep?.score !== undefined) {
                    return (
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`rounded-[3px] px-1 text-[10px] font-medium ${scoreColor(sleep.score)}`}
                          title={`Søvnscore${sleep.qualityLabel ? ` · ${sleep.qualityLabel}` : ""}`}
                        >
                          {sleep.score}
                        </span>
                        {sleep.durationMin !== null && (
                          <span className="text-[9px] text-dim">
                            {Math.floor(sleep.durationMin / 60)}t
                            {String(sleep.durationMin % 60).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    );
                  }
                  if (e?.sleepHoursX10 !== null && e?.sleepHoursX10 !== undefined) {
                    return (
                      <div className="text-[9px] text-dim">
                        {fmtHours(e.sleepHoursX10)} t søvn
                      </div>
                    );
                  }
                  return null;
                })()}
                {e?.mood !== null && e?.mood !== undefined && (
                  <div className={`h-1 rounded-full ${moodTone(e.mood)}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dim">
        <Legend className="bg-success" label="Godt humør" />
        <Legend className="bg-warning" label="Neutralt" />
        <Legend className="bg-danger" label="Lavt / hovedpine" />
        <Legend className="bg-border" label="Ikke logget" />
      </div>

      {selected && (
        <DayEditor
          key={selected}
          date={selected}
          entry={entries.get(selected) ?? null}
          sleep={sleeps.get(selected) ?? null}
          trackers={trackers}
          onClose={() => setSelected(null)}
          onSaved={(saved) => {
            setEntries((m) => {
              const next = new Map(m);
              next.set(saved.date, saved);
              return next;
            });
          }}
          onSleepDeleted={() => {
            setSleeps((m) => {
              const next = new Map(m);
              next.delete(selected);
              return next;
            });
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.5px] text-light">{label}</div>
      <div className={`text-[15px] font-medium ${tone ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function DayEditor({
  date,
  entry,
  sleep,
  trackers,
  onClose,
  onSaved,
  onSleepDeleted,
}: {
  date: string;
  entry: Entry | null;
  sleep: Sleep | null;
  trackers: { id: number; name: string; kind: string }[];
  onClose: () => void;
  onSaved: (saved: Entry) => void;
  onSleepDeleted: () => void;
}) {
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(entry?.energy ?? null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(
    entry?.sleepQuality ?? null,
  );
  const [headache, setHeadache] = useState(entry?.headache ?? false);
  const [headacheIntensity, setHeadacheIntensity] = useState<number | null>(
    entry?.headacheIntensity ?? null,
  );
  const [iskiasPain, setIskiasPain] = useState<number | null>(entry?.iskiasPain ?? null);
  const [alcoholUnits, setAlcoholUnits] = useState<number | null>(
    entry?.alcoholUnits ?? null,
  );
  const [constipation, setConstipation] = useState(entry?.constipation ?? false);
  const [constipationPain, setConstipationPain] = useState<number | null>(
    entry?.constipationPain ?? null,
  );
  const [seborrheicDermatitis, setSeborrheicDermatitis] = useState<number | null>(
    entry?.seborrheicDermatitis ?? null,
  );
  const [staph, setStaph] = useState<number | null>(entry?.staph ?? null);
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
  const [breathingDifficulty, setBreathingDifficulty] = useState<number | null>(
    entry?.breathingDifficulty ?? null,
  );
  const [breathingContext, setBreathingContext] = useState(
    entry?.breathingContext ?? "",
  );
  const [foamyUrine, setFoamyUrine] = useState(entry?.foamyUrine ?? false);
  const [foamyUrinePattern, setFoamyUrinePattern] = useState<
    "morning" | "all_day" | null
  >(entry?.foamyUrinePattern ?? null);
  const [sleepInput, setSleepInput] = useState(fmtHours(entry?.sleepHoursX10 ?? null));
  const [healthNotes, setHealthNotes] = useState(entry?.healthNotes ?? "");
  const [pending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const sleepHoursX10 = parseHours(sleepInput);
    const parseDecX10 = (s: string, max: number): number | null => {
      const t = s.trim().replace(",", ".");
      if (t === "") return null;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0 || n > max) return null;
      return Math.round(n * 10);
    };
    const weightX10 = parseDecX10(weightInput, 500);
    const waistX10 = parseDecX10(waistInput, 300);
    startSave(async () => {
      const res = await saveDayEntry({
        date,
        mood,
        energy,
        sleepHoursX10,
        sleepQuality,
        headache,
        headacheIntensity: headache ? headacheIntensity : null,
        iskiasPain,
        alcoholUnits,
        constipation,
        constipationPain: constipation ? constipationPain : null,
        seborrheicDermatitis,
        staph,
        didExercise,
        exerciseIntensity: didExercise ? exerciseIntensity : null,
        didFast: entry?.didFast ?? false,
        fastHoursX10: entry?.fastHoursX10 ?? null,
        fastBreakTime: entry?.fastBreakTime ?? null,
        weightX10,
        waistX10,
        breathingDifficulty,
        breathingContext: breathingDifficulty ? breathingContext.trim() || null : null,
        foamyUrine,
        foamyUrinePattern: foamyUrine ? foamyUrinePattern : null,
        healthNotes: healthNotes.trim() || null,
        workNotes: entry?.workNotes || null,
        dayNotes: entry?.dayNotes || null,
        wentWell: entry?.wentWell || null,
        nextStep: entry?.nextStep || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved({
        date,
        mood,
        energy,
        sleepHoursX10,
        sleepQuality,
        headache,
        headacheIntensity: headache ? headacheIntensity : null,
        iskiasPain,
        alcoholUnits,
        constipation,
        constipationPain: constipation ? constipationPain : null,
        seborrheicDermatitis,
        staph,
        didExercise,
        exerciseIntensity: didExercise ? exerciseIntensity : null,
        didFast: entry?.didFast ?? false,
        fastHoursX10: entry?.fastHoursX10 ?? null,
        fastBreakTime: entry?.fastBreakTime ?? null,
        weightX10,
        waistX10,
        breathingDifficulty,
        breathingContext: breathingDifficulty ? breathingContext : "",
        foamyUrine,
        foamyUrinePattern: foamyUrine ? foamyUrinePattern : null,
        healthNotes,
        workNotes: entry?.workNotes ?? "",
        dayNotes: entry?.dayNotes ?? "",
        wentWell: entry?.wentWell ?? "",
        nextStep: entry?.nextStep ?? "",
      });
      onClose();
    });
  }

  return (
    <div className="mt-5 rounded-md border border-accent bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between border-b border-border-light pb-2.5">
        <h2 className="font-serif text-[19px] text-accent-bright">
          {formatDanishDate(date)}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-mid hover:text-ink"
        >
          ✕
        </button>
      </div>

      {sleep && (
        <GarminSleepDetails
          sleep={sleep}
          onDelete={async () => {
            if (!confirm("Slet Garmin-søvndata for denne dag?")) return;
            await deleteSleepEntry(date);
            onSleepDeleted();
          }}
        />
      )}


      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>Humør</FieldLabel>
            <Scale value={mood} onChange={setMood} max={5} lo="lavt" hi="højt" />
          </div>
          <div>
            <FieldLabel>Energi</FieldLabel>
            <Scale value={energy} onChange={setEnergy} max={5} lo="lavt" hi="højt" />
          </div>
          <div>
            <FieldLabel>
              Søvn (timer)
              {sleep?.durationMin && (
                <span className="ml-2 rounded-[3px] bg-accent-bg px-1.5 py-0.5 text-[10px] uppercase tracking-[0.4px] text-accent-bright">
                  Garmin
                </span>
              )}
            </FieldLabel>
            {sleep?.durationMin ? (
              <div className="rounded-[3px] border border-border-light bg-bg px-3 py-2 text-[14px] text-ink">
                {`${Math.floor(sleep.durationMin / 60)}t ${String(sleep.durationMin % 60).padStart(2, "0")}m`}
              </div>
            ) : (
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={sleepInput}
                onChange={(e) => setSleepInput(e.target.value)}
                placeholder="Fx 7,5"
                className="!w-32"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>
              Søvnkvalitet
              {sleep?.score !== null && sleep?.score !== undefined && (
                <span
                  className="ml-2 rounded-[3px] bg-accent-bg px-1.5 py-0.5 text-[10px] uppercase tracking-[0.4px] text-accent-bright"
                  title={sleep.qualityLabel ?? undefined}
                >
                  Garmin
                </span>
              )}
            </FieldLabel>
            <SleepQualityScale
              value={
                sleep?.score !== null && sleep?.score !== undefined
                  ? garminScoreToQuality(sleep.score)
                  : sleepQuality
              }
              onChange={setSleepQuality}
              disabled={sleep?.score !== null && sleep?.score !== undefined}
            />
          </div>
          <div>
            <FieldLabel>Iskias-smerte</FieldLabel>
            <Scale
              value={iskiasPain}
              onChange={setIskiasPain}
              max={5}
              lo="ingen"
              hi="stærk"
            />
          </div>
          <div>
            <FieldLabel>Skæleksem</FieldLabel>
            <Scale
              value={seborrheicDermatitis}
              onChange={setSeborrheicDermatitis}
              max={5}
              lo="ingen"
              hi="slemt"
            />
          </div>
          <div>
            <FieldLabel>Stafylokokker</FieldLabel>
            <Scale
              value={staph}
              onChange={setStaph}
              max={5}
              lo="ingen"
              hi="slemt"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Vejrtrækningsbesvær</FieldLabel>
          <Scale
            value={breathingDifficulty}
            onChange={(v) => {
              setBreathingDifficulty(v);
              if (!v) setBreathingContext("");
            }}
            max={5}
            lo="ingen"
            hi="svært"
          />
          {breathingDifficulty && (
            <div className="mt-3">
              <FieldLabel>
                Hvornår / hvor?{" "}
                <span className="ml-1 italic text-dim">— valgfri</span>
              </FieldLabel>
              <input
                type="text"
                value={breathingContext}
                onChange={(e) => setBreathingContext(e.target.value)}
                placeholder="Fx 'efter trappe', 'da jeg lagde mig'"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>
              Vægt <span className="ml-1 italic text-dim">— kg</span>
            </FieldLabel>
            <input
              type="text"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="Fx 78,5"
              className="!w-32"
            />
          </div>
          <div>
            <FieldLabel>
              Livvidde <span className="ml-1 italic text-dim">— cm</span>
            </FieldLabel>
            <input
              type="text"
              inputMode="decimal"
              value={waistInput}
              onChange={(e) => setWaistInput(e.target.value)}
              placeholder="Fx 89,5"
              className="!w-32"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>Hovedpine</FieldLabel>
            <YesNo value={headache} onChange={setHeadache} />
            {headache && (
              <div className="mt-3">
                <FieldLabel>Intensitet (1–10)</FieldLabel>
                <Scale
                  value={headacheIntensity}
                  onChange={setHeadacheIntensity}
                  max={10}
                />
              </div>
            )}
          </div>
          <div>
            <FieldLabel>Forstoppelse</FieldLabel>
            <YesNo value={constipation} onChange={setConstipation} />
            {constipation && (
              <div className="mt-3">
                <FieldLabel>Smerte</FieldLabel>
                <Scale
                  value={constipationPain}
                  onChange={setConstipationPain}
                  max={5}
                  lo="let"
                  hi="stærk"
                />
              </div>
            )}
          </div>
          <div>
            <FieldLabel>
              Genstande <span className="ml-1 italic text-dim">— alkohol</span>
            </FieldLabel>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={alcoholUnits === null ? "" : alcoholUnits}
              onChange={(e) => {
                const v = e.target.value.trim();
                setAlcoholUnits(
                  v === "" ? null : Math.max(0, Math.floor(Number(v))),
                );
              }}
              placeholder="0"
              className="!w-24"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Træning?</FieldLabel>
          <div className="flex gap-1.5">
            {[
              { label: "Ja", v: true },
              { label: "Nej", v: false },
            ].map(({ label, v }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setDidExercise(v);
                  if (!v) setExerciseIntensity(null);
                }}
                className={`cursor-pointer rounded-[3px] border px-3.5 py-2 text-[13px] transition ${
                  didExercise === v
                    ? "border-accent bg-accent-bg text-accent-bright"
                    : "border-border bg-bg text-mid hover:border-accent-dim"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {didExercise && (
            <div className="mt-3">
              <FieldLabel>Intensitet</FieldLabel>
              <div className="flex gap-1.5">
                {(
                  [
                    { v: "light", label: "Let" },
                    { v: "medium", label: "Mellem" },
                    { v: "hard", label: "Hård" },
                  ] as const
                ).map(({ v, label }) => {
                  const active = exerciseIntensity === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setExerciseIntensity(active ? null : v)}
                      className={`flex-1 cursor-pointer rounded-[3px] border px-3.5 py-2 text-[13px] transition ${
                        active
                          ? "border-accent bg-accent-bg text-accent-bright"
                          : "border-border bg-bg text-mid hover:border-accent-dim hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <FieldLabel>Skummende urin?</FieldLabel>
          <div className="flex gap-1.5">
            {[
              { label: "Ja", v: true },
              { label: "Nej", v: false },
            ].map(({ label, v }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setFoamyUrine(v);
                  if (!v) setFoamyUrinePattern(null);
                }}
                className={`cursor-pointer rounded-[3px] border px-3.5 py-2 text-[13px] transition ${
                  foamyUrine === v
                    ? "border-accent bg-accent-bg text-accent-bright"
                    : "border-border bg-bg text-mid hover:border-accent-dim"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {foamyUrine && (
            <div className="mt-3">
              <FieldLabel>Hvornår?</FieldLabel>
              <div className="flex gap-1.5">
                {(
                  [
                    { v: "morning", label: "Morgenstunden" },
                    { v: "all_day", label: "Hen over dagen" },
                  ] as const
                ).map(({ v, label }) => {
                  const active = foamyUrinePattern === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFoamyUrinePattern(active ? null : v)}
                      className={`flex-1 cursor-pointer rounded-[3px] border px-3.5 py-2 text-[13px] transition ${
                        active
                          ? "border-accent bg-accent-bg text-accent-bright"
                          : "border-border bg-bg text-mid hover:border-accent-dim hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <FieldLabel>Helbredsnoter</FieldLabel>
          <textarea
            value={healthNotes}
            onChange={(e) => setHealthNotes(e.target.value)}
            rows={3}
            placeholder="Symptomer, medicin, observationer..."
          />
        </div>

        <TrackerPhotoAdd date={date} trackers={trackers} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Gemmer..." : "Gem"}
        </button>
        {error && <span className="text-[13px] text-danger">{error}</span>}
        {entry &&
          (entry.workNotes ||
            entry.dayNotes ||
            entry.wentWell ||
            entry.nextStep) && (
            <span className="text-[12px] text-dim">
              Dagsnotater bevares (redigeres på I dag / Journal)
            </span>
          )}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[13px] font-medium text-mid">{children}</label>
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
    <div className="flex gap-1.5">
      {[
        { label: "Nej", v: false },
        { label: "Ja", v: true },
      ].map(({ label, v }) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 cursor-pointer rounded-[3px] border px-3.5 py-2 text-[13px] transition ${
            value === v
              ? "border-accent bg-accent-bg text-accent-bright"
              : "border-border bg-bg text-mid hover:border-accent-dim"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Scale({
  value,
  onChange,
  max,
  lo,
  hi,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  max: number;
  lo?: string;
  hi?: string;
}) {
  const maxWidthPx = max * 36 + (max - 1) * 4;
  return (
    <div style={{ maxWidth: `${maxWidthPx}px` }}>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(active ? null : n)}
              className={`aspect-square max-w-[36px] flex-1 cursor-pointer rounded-[3px] border text-[13px] font-medium transition ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-bg text-mid hover:border-accent-dim"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(lo || hi) && (
        <div className="mt-1 flex justify-between text-[11px] italic text-dim">
          <span>{lo ?? ""}</span>
          <span>{hi ?? ""}</span>
        </div>
      )}
    </div>
  );
}

// --- Garmin sleep details -------------------------------------------------

function GarminSleepDetails({
  sleep,
  onDelete,
}: {
  sleep: Sleep;
  onDelete: () => void;
}) {
  return (
    <div className="mb-4 rounded-[4px] border border-[var(--accent-dim)] bg-[rgba(74,144,226,0.06)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-serif text-[15px] text-accent-bright">
            Garmin søvn
          </span>
          {sleep.score !== null && (
            <span
              className={`rounded-[3px] px-1.5 py-0.5 text-[11px] font-medium ${scoreColor(sleep.score)}`}
            >
              {sleep.score}
              {sleep.qualityLabel ? ` · ${sleep.qualityLabel}` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="cursor-pointer text-[11px] text-dim hover:text-danger"
          title="Slet Garmin-data for denne dag"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-4">
        <SleepStat label="Varighed" value={fmtMinutes(sleep.durationMin)} />
        <SleepStat label="Dyb" value={fmtMinutes(sleep.deepMin)} />
        <SleepStat label="Let" value={fmtMinutes(sleep.lightMin)} />
        <SleepStat label="REM" value={fmtMinutes(sleep.remMin)} />
        <SleepStat label="Vågen" value={fmtMinutes(sleep.awakeMin)} />
        <SleepStat
          label="Hvilepuls"
          value={sleep.restingHeartRate !== null ? `${sleep.restingHeartRate} bpm` : "–"}
        />
        <SleepStat
          label="HRV"
          value={
            sleep.hrvMs !== null
              ? `${sleep.hrvMs} ms${sleep.hrv7dStatus ? ` · ${sleep.hrv7dStatus}` : ""}`
              : "–"
          }
        />
        <SleepStat
          label="SpO₂ Ø"
          value={sleep.avgSpO2 !== null ? `${sleep.avgSpO2}%` : "–"}
        />
        <SleepStat
          label="Stress Ø"
          value={sleep.avgStress !== null ? String(sleep.avgStress) : "–"}
        />
        <SleepStat
          label="Body Battery"
          value={
            sleep.bodyBatteryChange !== null
              ? (sleep.bodyBatteryChange > 0 ? "+" : "") + sleep.bodyBatteryChange
              : "–"
          }
        />
        <SleepStat
          label="Vejrtræk. Ø"
          value={
            sleep.avgBreathingX10 !== null
              ? `${(sleep.avgBreathingX10 / 10).toString().replace(".", ",")} brpm`
              : "–"
          }
        />
        <SleepStat
          label="Nattepuls Ø"
          value={sleep.avgHeartRate !== null ? `${sleep.avgHeartRate} bpm` : "–"}
        />
      </div>
    </div>
  );
}

function SleepStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.4px] text-light">{label}</div>
      <div className="text-[13px] text-ink">{value}</div>
    </div>
  );
}

// --- Sleep import ---------------------------------------------------------

function SleepImport({ onImported }: { onImported: (s: Sleep) => void }) {
  const [pending, startImport] = useTransition();
  const [results, setResults] = useState<{ ok: boolean; text: string }[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setResults([]);
    startImport(async () => {
      const out: { ok: boolean; text: string }[] = [];
      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          const res = await importGarminSleepCsv({ csvText: text, filename: file.name });
          if (res.ok) {
            out.push({
              ok: true,
              text: `${file.name}: ${res.action === "created" ? "tilføjet" : "opdateret"} (${res.date})`,
            });
            // Hent den lige indsatte søvn-entry tilbage til UI'et —
            // server-action returnerer ikke det fulde objekt, så vi parser igen
            // og bruger det til at opdatere kalenderen optimistisk.
            const reparsed = await import("@/lib/garmin-sleep").then((m) =>
              m.parseGarminSleepCsv(text),
            );
            if (reparsed) {
              onImported({
                date: reparsed.date,
                durationMin: reparsed.durationMin,
                score: reparsed.score,
                qualityLabel: reparsed.qualityLabel,
                deepMin: reparsed.deepMin,
                lightMin: reparsed.lightMin,
                remMin: reparsed.remMin,
                awakeMin: reparsed.awakeMin,
                avgStress: reparsed.avgStress,
                avgHeartRate: reparsed.avgHeartRate,
                restingHeartRate: reparsed.restingHeartRate,
                bodyBatteryChange: reparsed.bodyBatteryChange,
                avgSpO2: reparsed.avgSpO2,
                lowestSpO2: reparsed.lowestSpO2,
                avgBreathingX10: reparsed.avgBreathingX10,
                hrvMs: reparsed.hrvMs,
                hrv7dStatus: reparsed.hrv7dStatus,
              });
            }
          } else {
            out.push({ ok: false, text: res.error });
          }
        } catch (e) {
          out.push({
            ok: false,
            text: `${file.name}: ${e instanceof Error ? e.message : "ukendt fejl"}`,
          });
        }
      }
      setResults(out);
    });
  }

  return (
    <details className="mb-5 rounded-md border border-border bg-card">
      <summary className="cursor-pointer list-none px-5 py-3 text-[14px] text-mid hover:text-ink">
        <span className="font-serif text-accent-bright">Importér Garmin-søvn</span>
        <span className="ml-3 text-[12px] text-dim">
          Træk eller vælg én eller flere CSV-filer eksporteret fra Garmin Connect
        </span>
      </summary>
      <div className="border-t border-border-light px-5 py-3">
        <input
          type="file"
          accept=".csv,text/csv,application/vnd.ms-excel"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          disabled={pending}
          className="!w-auto text-[13px] text-mid file:mr-3 file:cursor-pointer file:rounded-[3px] file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
        />
        {pending && <span className="ml-3 text-[12px] text-light">Importerer...</span>}
        {results.length > 0 && (
          <ul className="mt-3 space-y-1">
            {results.map((r, i) => (
              <li
                key={i}
                className={`text-[12px] ${r.ok ? "text-success" : "text-danger"}`}
              >
                {r.ok ? "✓" : "✗"} {r.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
