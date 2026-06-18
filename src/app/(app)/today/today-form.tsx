"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createJobApplication,
  createProject,
  deleteJobApplication,
  saveDayEntry,
  saveDayGoals,
  setFocusProject,
  setWeekGoal,
  updateJobApplicationStatus,
} from "./actions";
import { deleteTimeEntry, saveTimeEntry } from "../projects/actions";
import {
  createSupplement,
  deleteSupplement,
  deleteSupplementIntake,
  logSupplementIntake,
} from "./supplement-actions";
import { deleteFast, endFast, startFast, updateFast } from "./fast-actions";
import {
  ApplicationDocuments,
  type DocSummary,
} from "@/components/application-documents";
import {
  TrackerPhotoSection,
  type TrackerRef,
} from "@/components/tracker-photo-section";
import { CustomParametersSection } from "@/components/custom-parameters-section";
import type {
  CustomParamSummary,
  CustomValueRow,
} from "@/lib/custom-parameters";
import {
  Activity,
  Apple,
  Camera,
  Check,
  Circle,
  Hourglass,
  Moon,
  Pencil,
  Scale as ScaleIcon,
  Smile,
  Sparkles,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  Section as FieldSection,
  Field as FieldRow,
  Scale1to5,
  YesNo as YesNoButtons,
  IntensityPicker,
  CompactNumberInput,
} from "@/components/health-fields";
import {
  FAST_QUALIFIED_MINUTES,
  fastDurationMinutes,
  formatFastDuration,
  formatTimestampShort,
  isQualifiedFast,
} from "@/lib/fast";
import { danishLongDate, danishWeekday } from "@/lib/date";
import { garminScoreToQuality } from "@/lib/sleep";
import { FileLinks } from "@/components/file-links";
import { SleepQualityScale } from "@/components/sleep-quality-scale";

type Status =
  | "sent"
  | "no_response"
  | "replied"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

type AppDoc = {
  id: number;
  title: string;
  kind: string;
  filename: string;
  mimeType: string;
};

type AppItem = {
  id: number;
  company: string;
  role: string;
  files: string;
  status: Status;
  documents: AppDoc[];
};

type DayState = {
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
  workNotes: string;
  healthNotes: string;
  dayNotes: string;
  wentWell: string;
  nextStep: string;
};

type TimeEntry = {
  id: number;
  projectId: number;
  hoursX10: number;
  notes: string;
};

type ProjectRef = { id: number; name: string };

type TimeOfDay = "morning" | "midday" | "evening" | "night";

type SupplementDef = {
  id: number;
  name: string;
  defaultDoseAmountX100: number | null;
  defaultDoseUnit: string | null;
  defaultTimeOfDay: TimeOfDay | null;
  archived: boolean;
};

type ActiveFast = {
  id: number;
  startedAt: string;
  note: string | null;
} | null;

type RecentFast = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
};

type SupplementIntake = {
  id: number;
  name: string;
  supplementId: number | null;
  doseAmountX100: number | null;
  doseUnit: string | null;
  timeOfDay: TimeOfDay | null;
  note: string | null;
};

const STATUS_LABELS: Record<Status, string> = {
  sent: "Sendt",
  no_response: "Intet svar",
  replied: "Svar",
  interview: "Samtale",
  offer: "Tilbud",
  rejected: "Afvist",
  withdrawn: "Trukket",
};

const STATUS_CLASSES: Record<Status, string> = {
  sent: "bg-[rgba(74,144,226,0.15)] text-[var(--accent-bright)]",
  no_response: "bg-[rgba(160,174,192,0.15)] text-[var(--mid)]",
  replied: "bg-[rgba(251,191,36,0.15)] text-[var(--warning)]",
  interview: "bg-[rgba(74,222,128,0.15)] text-[var(--success)]",
  offer: "bg-[rgba(74,222,128,0.25)] text-[var(--success)]",
  rejected: "bg-[rgba(248,113,113,0.15)] text-[var(--danger)]",
  withdrawn: "bg-[rgba(160,174,192,0.15)] text-[var(--mid)]",
};

function hoursDisplay(x10: number | null): string {
  return x10 === null ? "" : (x10 / 10).toString().replace(".", ",");
}

function parseHours(s: string): number | null {
  const trimmed = s.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 24) return null;
  return Math.round(n * 10);
}

type GarminSleepSummary = {
  durationMin: number | null;
  score: number | null;
  qualityLabel: string | null;
};

type WeekGoalState = {
  text: string;
  applicationsTarget: number | null;
  focusHoursTargetX10: number | null;
};

type DayGoalsState = {
  applicationsTarget: number | null;
  focusHoursTargetX10: number | null;
  goalNote: string;
};

export function TodayPage(props: {
  date: string;
  weekStart: string;
  weekAppsCount: number;
  weekHoursX10: number;
  initialWeekGoal: WeekGoalState;
  initialDayGoals: DayGoalsState;
  projects: ProjectRef[];
  initialFocusProjectId: number | null;
  initialTimeEntries: TimeEntry[];
  initialApplications: AppItem[];
  unattachedDocuments: AppDoc[];
  trackers: TrackerRef[];
  customParameters: CustomParamSummary[];
  customValues: CustomValueRow[];
  initialDay: DayState;
  garminSleep: GarminSleepSummary | null;
  yesterdayNextStep: string;
  supplements: SupplementDef[];
  initialSupplementIntakes: SupplementIntake[];
  activeFast: ActiveFast;
  recentFasts: RecentFast[];
  lastSavedAt: string | null;
}) {
  const [day, setDay] = useState<DayState>(props.initialDay);
  const [sleepInput, setSleepInput] = useState(hoursDisplay(props.initialDay.sleepHoursX10));
  const [supplements, setSupplements] = useState<SupplementDef[]>(props.supplements);
  const [supplementIntakes, setSupplementIntakes] = useState<SupplementIntake[]>(
    props.initialSupplementIntakes,
  );
  const [apps, setApps] = useState<AppItem[]>(props.initialApplications);
  const [unattached, setUnattached] = useState<AppDoc[]>(
    props.unattachedDocuments,
  );
  const [projects, setProjects] = useState<ProjectRef[]>(props.projects);
  const [focusProjectId, setFocusProjectIdState] = useState<number | null>(
    props.initialFocusProjectId,
  );
  const [entries, setEntries] = useState<TimeEntry[]>(props.initialTimeEntries);
  const [weekGoal, setWeekGoalState] = useState<WeekGoalState>(props.initialWeekGoal);
  const [dayGoals, setDayGoalsState] = useState<DayGoalsState>(props.initialDayGoals);
  const [lastSaved, setLastSaved] = useState<string | null>(props.lastSavedAt);
  const [savingDay, startSaveDay] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const todayHoursX10 = useMemo(
    () => entries.reduce((s, e) => s + e.hoursX10, 0),
    [entries],
  );

  function handleSaveDay() {
    setError(null);
    const dayInput = {
      date: props.date,
      mood: day.mood,
      energy: day.energy,
      sleepHoursX10: parseHours(sleepInput),
      sleepQuality: day.sleepQuality,
      alcoholUnits: day.alcoholUnits,
      didExercise: day.didExercise,
      exerciseIntensity: day.didExercise ? day.exerciseIntensity : null,
      didFast: day.didFast,
      fastHoursX10: day.didFast ? day.fastHoursX10 : null,
      fastBreakTime: day.didFast ? day.fastBreakTime : null,
      weightX10: day.weightX10,
      waistX10: day.waistX10,
      carbsG: day.carbsG,
      proteinG: day.proteinG,
      fatG: day.fatG,
      workNotes: day.workNotes || null,
      healthNotes: day.healthNotes || null,
      dayNotes: day.dayNotes || null,
      wentWell: day.wentWell || null,
      nextStep: day.nextStep || null,
    };
    startSaveDay(async () => {
      const res = await saveDayEntry(dayInput);
      if (!res.ok) setError(res.error);
      else setLastSaved(res.savedAt);
    });
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <PageHeader date={props.date} />
      <WeekStatsCard
        weekStart={props.weekStart}
        weekGoal={weekGoal}
        onWeekGoalChange={setWeekGoalState}
        appsToday={apps.length}
        appsThisWeek={props.weekAppsCount}
        todayHoursX10={todayHoursX10}
        weekHoursX10={props.weekHoursX10}
      />
      <DayGoalsCard
        date={props.date}
        value={dayGoals}
        onChange={setDayGoalsState}
        appsToday={apps.length}
        todayHoursX10={todayHoursX10}
        yesterdayNextStep={props.yesterdayNextStep}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Jobsøgning" meta="i dag">
          <ApplicationsList
            apps={apps}
            onChange={setApps}
            date={props.date}
            unattachedDocs={unattached}
            setUnattachedDocs={setUnattached}
            onError={setError}
          />
        </Card>

        <Card title="Fokus" meta="i dag">
          <FocusBody
            date={props.date}
            entries={entries}
            setEntries={setEntries}
            projects={projects}
            setProjects={setProjects}
            focusProjectId={focusProjectId}
            setFocusProjectId={setFocusProjectIdState}
            day={day}
            setDay={setDay}
            onError={setError}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card
          title={
            <>
              Helbred
              <span className="ml-2 text-[13px] italic text-dim">— valgfrit</span>
            </>
          }
        >
          <HealthBody
            day={day}
            setDay={setDay}
            sleepInput={sleepInput}
            setSleepInput={setSleepInput}
            garminSleep={props.garminSleep}
            date={props.date}
            trackers={props.trackers}
            customParameters={props.customParameters}
            customValues={props.customValues}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card title="Faste" meta="live">
          <FastCard
            initialActive={props.activeFast}
            initialRecent={props.recentFasts}
            onError={setError}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card title="Kosttilskud" meta="i dag">
          <SupplementsBody
            date={props.date}
            supplements={supplements}
            setSupplements={setSupplements}
            intakes={supplementIntakes}
            setIntakes={setSupplementIntakes}
            onError={setError}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card title="Dagsnoter" full>
          <div>
            <Label>
              Hvad skete der ellers i dag?{" "}
              <span className="ml-1 italic text-dim">— valgfrit</span>
            </Label>
            <textarea
              value={day.dayNotes}
              onChange={(e) => setDay({ ...day, dayNotes: e.target.value })}
              rows={4}
              placeholder="Møder, ærinder, sociale ting, vejret, hvad du tænkte over..."
            />
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div className="text-sm text-light">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : lastSaved ? (
            <span>
              Sidst gemt kl.{" "}
              {new Date(lastSaved).toLocaleTimeString("da-DK", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <span>Ikke gemt endnu</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSaveDay}
          disabled={savingDay}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-7 py-2.5 text-sm font-medium text-white transition hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingDay ? "Gemmer..." : "Gem dagen"}
        </button>
      </div>
    </div>
  );
}

function PageHeader({ date }: { date: string }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <h1 className="font-serif text-[36px] font-medium leading-none text-ink">Log</h1>
      <div className="text-right">
        <div className="text-sm font-medium uppercase tracking-[1px] text-accent-bright">
          {danishWeekday(date)}
        </div>
        <div className="font-serif text-[22px] text-ink">{danishLongDate(date)}</div>
      </div>
    </header>
  );
}

function WeekStatsCard({
  weekStart,
  weekGoal,
  onWeekGoalChange,
  appsToday,
  appsThisWeek,
  todayHoursX10,
  weekHoursX10,
}: {
  weekStart: string;
  weekGoal: WeekGoalState;
  onWeekGoalChange: (v: WeekGoalState) => void;
  appsToday: number;
  appsThisWeek: number;
  todayHoursX10: number;
  weekHoursX10: number;
}) {
  const [editing, setEditing] = useState(false);
  const hasAnyGoal =
    weekGoal.applicationsTarget !== null ||
    weekGoal.focusHoursTargetX10 !== null ||
    weekGoal.text.trim() !== "";

  // Display values
  const todayHours = todayHoursX10
    ? `${(todayHoursX10 / 10).toString().replace(".", ",")}t`
    : "0t";
  const weekHoursStr = `${(weekHoursX10 / 10).toString().replace(".", ",")}t`;
  const weekAppsDisplay =
    weekGoal.applicationsTarget !== null
      ? `${appsThisWeek} / ${weekGoal.applicationsTarget}`
      : String(appsThisWeek);
  const weekHoursDisplay =
    weekGoal.focusHoursTargetX10 !== null
      ? `${weekHoursStr} / ${(weekGoal.focusHoursTargetX10 / 10).toString().replace(".", ",")}t`
      : weekHoursStr;

  return (
    <div className="mb-4 rounded-md border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat number={appsToday} label="Ansøgninger i dag" />
        <Stat
          number={weekAppsDisplay}
          label="Ansøgninger denne uge"
          progress={
            weekGoal.applicationsTarget !== null
              ? { value: appsThisWeek, target: weekGoal.applicationsTarget }
              : null
          }
        />
        <Stat number={todayHours} label="Fokus i dag" />
        <Stat
          number={weekHoursDisplay}
          label="Fokus denne uge"
          progress={
            weekGoal.focusHoursTargetX10 !== null
              ? { value: weekHoursX10, target: weekGoal.focusHoursTargetX10 }
              : null
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-light pt-2">
        {weekGoal.text.trim() !== "" && !editing ? (
          <span className="font-serif text-[13px] italic text-mid">
            “{weekGoal.text}”
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="cursor-pointer text-[12px] text-light hover:text-accent-bright"
        >
          {editing ? "✕ Skjul" : hasAnyGoal ? "✎ Rediger ugemål" : "+ Sæt mål for ugen"}
        </button>
      </div>

      {editing && (
        <WeekGoalEditor
          weekStart={weekStart}
          value={weekGoal}
          onChange={onWeekGoalChange}
        />
      )}
    </div>
  );
}

function DayGoalsCard({
  date,
  value,
  onChange,
  yesterdayNextStep,
}: {
  date: string;
  value: DayGoalsState;
  onChange: (v: DayGoalsState) => void;
  appsToday: number;
  todayHoursX10: number;
  yesterdayNextStep: string;
}) {
  const [editing, setEditing] = useState(false);
  const noteText = value.goalNote.trim();
  const hasNotes = noteText !== "";
  const hasYesterdayHint = yesterdayNextStep.trim() !== "" && !hasNotes;

  // Splits notes by newlines (and any "- " or "• " prefix) for bullet rendering.
  const noteLines = noteText
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);

  return (
    <div className="mb-4 rounded-md border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-[14px] italic text-accent-bright">
          Mål for i dag
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="cursor-pointer text-[12px] text-light hover:text-accent-bright"
        >
          {editing
            ? "✕ Skjul"
            : hasNotes
              ? "✎ Rediger"
              : "+ Tilføj noter"}
        </button>
      </div>

      {hasNotes && !editing && (
        <ul className="mt-2 space-y-1 text-[13px] text-ink">
          {noteLines.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-dim">•</span>
              <span className="whitespace-pre-wrap">{line}</span>
            </li>
          ))}
        </ul>
      )}

      {!hasNotes && !editing && (
        <div className="mt-1 space-y-1">
          <p className="text-[13px] italic text-light">
            Ingen noter for i dag endnu.
          </p>
          {hasYesterdayHint && (
            <p className="text-[12px] text-dim">
              Fra i går:{" "}
              <span className="italic text-mid">“{yesterdayNextStep}”</span>{" "}
              — åbnes som forslag når du klikker “+ Tilføj noter”.
            </p>
          )}
        </div>
      )}

      {editing && (
        <DayGoalsEditor
          date={date}
          value={value}
          onChange={onChange}
          yesterdayNextStep={yesterdayNextStep}
        />
      )}
    </div>
  );
}

function DayGoalsEditor({
  date,
  value,
  onChange,
  yesterdayNextStep,
}: {
  date: string;
  value: DayGoalsState;
  onChange: (v: DayGoalsState) => void;
  yesterdayNextStep: string;
}) {
  const seededFromYesterday =
    value.goalNote.trim() === "" && yesterdayNextStep.trim() !== "";
  const [noteInput, setNoteInput] = useState(
    seededFromYesterday ? yesterdayNextStep : value.goalNote,
  );
  const [, startTransition] = useTransition();

  function save(text: string) {
    const next: DayGoalsState = { ...value, goalNote: text };
    onChange(next);
    startTransition(async () => {
      await saveDayGoals({
        date,
        applicationsTarget: next.applicationsTarget,
        focusHoursTargetX10: next.focusHoursTargetX10,
        goalNote: next.goalNote,
      });
    });
  }

  return (
    <div className="mt-3">
      {seededFromYesterday && (
        <p className="mb-2 text-[11px] italic text-accent-bright">
          Forslag medbragt fra gårsdagens “Næste skridt”. Rediger eller slet
          før du gemmer.
        </p>
      )}
      <textarea
        value={noteInput}
        onChange={(e) => setNoteInput(e.target.value)}
        onBlur={() => save(noteInput)}
        placeholder={"Én note pr. linje — fx:\n- Færdiggør CV-design\n- Send ansøgning til Ravnit\n- Træn i 30 min"}
        rows={4}
        className="text-[13px]"
      />
      <p className="mt-1 text-[11px] italic text-dim">
        Tip: hver linje vises som et punkt. Linjer der starter med “-” eller “•”
        bliver formatteret pænt.
      </p>
    </div>
  );
}

function WeekGoalEditor({
  weekStart,
  value,
  onChange,
}: {
  weekStart: string;
  value: WeekGoalState;
  onChange: (v: WeekGoalState) => void;
}) {
  const [appsInput, setAppsInput] = useState(
    value.applicationsTarget === null ? "" : String(value.applicationsTarget),
  );
  const [hoursInput, setHoursInput] = useState(
    value.focusHoursTargetX10 === null
      ? ""
      : (value.focusHoursTargetX10 / 10).toString().replace(".", ","),
  );
  const [textInput, setTextInput] = useState(value.text);
  const [, startTransition] = useTransition();

  function parseAppsTarget(s: string): number | null {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  function parseHoursTargetX10(s: string): number | null {
    const t = s.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 240) return null;
    return Math.round(n * 10);
  }

  function save(partial: Partial<WeekGoalState>) {
    const next: WeekGoalState = {
      text: partial.text ?? value.text,
      applicationsTarget:
        partial.applicationsTarget === undefined
          ? value.applicationsTarget
          : partial.applicationsTarget,
      focusHoursTargetX10:
        partial.focusHoursTargetX10 === undefined
          ? value.focusHoursTargetX10
          : partial.focusHoursTargetX10,
    };
    onChange(next);
    startTransition(async () => {
      await setWeekGoal({
        weekStart,
        text: next.text,
        applicationsTarget: next.applicationsTarget,
        focusHoursTargetX10: next.focusHoursTargetX10,
      });
    });
  }

  return (
    <div className="mt-3 rounded-[3px] border border-[var(--accent-dim)] bg-[rgba(74,144,226,0.06)] p-3">
      <div className="mb-2 font-serif text-[13px] italic text-accent-bright">
        Mål for ugen
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[13px] text-mid">
          Ansøgninger:
          <input
            type="number"
            min={0}
            step={1}
            value={appsInput}
            onChange={(e) => setAppsInput(e.target.value)}
            onBlur={() =>
              save({ applicationsTarget: parseAppsTarget(appsInput) })
            }
            placeholder="–"
            className="!w-16 !py-1 text-center text-[13px]"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-mid">
          Fokus-timer:
          <input
            type="number"
            min={0}
            max={240}
            step={0.5}
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            onBlur={() =>
              save({ focusHoursTargetX10: parseHoursTargetX10(hoursInput) })
            }
            placeholder="–"
            className="!w-20 !py-1 text-center text-[13px]"
          />
        </label>
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onBlur={() => save({ text: textInput })}
          placeholder="Note (valgfri) — fx 'Røket-redesign færdig'"
          className="!min-w-[180px] !flex-1 !py-1 text-[13px]"
        />
      </div>
    </div>
  );
}

function Stat({
  number,
  label,
  progress,
}: {
  number: number | string;
  label: string;
  progress?: { value: number; target: number } | null;
}) {
  const pct =
    progress && progress.target > 0
      ? Math.min(100, (progress.value / progress.target) * 100)
      : 0;
  const done = progress ? progress.value >= progress.target : false;
  return (
    <div className="text-center">
      <div className="font-serif text-[28px] font-medium leading-none text-accent-bright">
        {number}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.5px] text-light">{label}</div>
      {progress && (
        <div className="mx-auto mt-2 h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-bg">
          <div
            className={`h-full transition-all ${done ? "bg-success" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  meta,
  children,
  full = false,
}: {
  title: React.ReactNode;
  meta?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-border bg-card px-6 py-5 transition-colors hover:border-accent-dim ${full ? "col-span-full" : ""}`}
    >
      <div className="mb-4 flex items-baseline justify-between border-b border-border-light pb-2.5">
        <div className="font-serif text-[20px] font-medium text-accent-bright">{title}</div>
        {meta && (
          <div className="text-[12px] uppercase tracking-[0.5px] text-light">{meta}</div>
        )}
      </div>
      {children}
    </div>
  );
}

// --- Fokus (multi-projekt dagsregistrering) ---------------------------------

function FocusBody({
  date,
  entries,
  setEntries,
  projects,
  setProjects,
  focusProjectId,
  setFocusProjectId,
  day,
  setDay,
  onError,
}: {
  date: string;
  entries: TimeEntry[];
  setEntries: (e: TimeEntry[] | ((prev: TimeEntry[]) => TimeEntry[])) => void;
  projects: ProjectRef[];
  setProjects: (p: ProjectRef[] | ((prev: ProjectRef[]) => ProjectRef[])) => void;
  focusProjectId: number | null;
  setFocusProjectId: (id: number | null) => void;
  day: DayState;
  setDay: (d: DayState) => void;
  onError: (msg: string) => void;
}) {
  const projectName = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const initialSelection = focusProjectId ?? projects[0]?.id ?? null;
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    initialSelection,
  );
  const [hoursInput, setHoursInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [pending, startSave] = useTransition();

  if (projects.length === 0 && !addingProject) {
    return (
      <div>
        <div className="mb-3 text-sm text-mid">Ingen projekter endnu.</div>
        <button
          type="button"
          onClick={() => setAddingProject(true)}
          className="cursor-pointer rounded-[3px] border border-dashed border-border bg-bg p-2.5 text-sm text-light hover:border-accent hover:text-accent-bright"
        >
          + Opret et projekt
        </button>
      </div>
    );
  }

  async function createNewProject() {
    if (!newProjectName.trim()) return;
    const res = await createProject({ name: newProjectName.trim() });
    if (res.ok && res.project) {
      const p = { id: res.project.id, name: res.project.name };
      setProjects((xs) => [...xs, p]);
      setSelectedProjectId(p.id);
      if (focusProjectId === null) {
        setFocusProjectId(p.id);
        await setFocusProject(p.id);
      }
    } else if (!res.ok) {
      onError(res.error);
    }
    setNewProjectName("");
    setAddingProject(false);
  }

  function logTime() {
    if (selectedProjectId === null) return;
    const x10 = parseHours(hoursInput);
    if (x10 === null || x10 === 0) {
      onError("Skriv et gyldigt timetal.");
      return;
    }
    const projectId = selectedProjectId;
    startSave(async () => {
      const res = await saveTimeEntry({
        projectId,
        date,
        hoursX10: x10,
        notes: notesInput || null,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      if (res.entry) {
        const saved: TimeEntry = {
          id: res.entry.id,
          projectId: res.entry.projectId,
          hoursX10: res.entry.hoursX10,
          notes: res.entry.notes ?? "",
        };
        setEntries((prev) => {
          const without = prev.filter((e) => e.projectId !== projectId);
          return [...without, saved];
        });
      }
      setHoursInput("");
      setNotesInput("");
    });
  }

  async function removeEntry(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await deleteTimeEntry(id);
  }

  async function makeSelectedFocus() {
    if (selectedProjectId === null || selectedProjectId === focusProjectId) return;
    setFocusProjectId(selectedProjectId);
    await setFocusProject(selectedProjectId);
  }

  return (
    <div className="space-y-4">
      {/* Dagens entries */}
      {entries.length === 0 ? (
        <p className="text-[13px] italic text-dim">Ingen tid logget i dag endnu.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-[3px] border border-border-light bg-bg px-3 py-2 text-[13px]"
            >
              <span className="flex items-center gap-1.5 font-medium text-ink">
                {e.projectId === focusProjectId && (
                  <span className="text-accent-bright" title="Standard fokus-projekt">
                    ☆
                  </span>
                )}
                {projectName.get(e.projectId) ?? "Ukendt"}
              </span>
              <span className="ml-auto shrink-0 font-medium text-accent-bright">
                {hoursDisplay(e.hoursX10)} t
              </span>
              {e.notes && (
                <span className="min-w-0 max-w-[40%] truncate text-mid" title={e.notes}>
                  {e.notes}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeEntry(e.id)}
                className="cursor-pointer px-1 text-dim hover:text-danger"
                title="Slet registrering"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Log-form */}
      <div className="space-y-2 border-t border-border-light pt-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Label>Projekt</Label>
            <select
              value={selectedProjectId ?? ""}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              className="!py-1.5"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === focusProjectId ? `☆ ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Timer</Label>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              placeholder="2,5"
              className="!w-20 !py-1.5"
            />
          </div>
        </div>
        <input
          type="text"
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          placeholder="Note (valgfri) — fx 'opdaterede screenshots i Play Store'"
          className="!py-1.5"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={logTime}
            disabled={pending || selectedProjectId === null}
            className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            {pending ? "..." : "+ Log tid"}
          </button>
          {selectedProjectId !== null && selectedProjectId !== focusProjectId && (
            <button
              type="button"
              onClick={makeSelectedFocus}
              className="cursor-pointer rounded-[3px] border border-border bg-transparent px-3 py-2 text-[12px] text-mid hover:border-accent-dim hover:text-accent-bright"
              title="Sæt som standardprojekt (vises først)"
            >
              ☆ Sæt som standard
            </button>
          )}
          {addingProject ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Nyt projektnavn"
                onKeyDown={(e) => e.key === "Enter" && createNewProject()}
                autoFocus
                className="!flex-1 !py-1.5"
              />
              <button
                type="button"
                onClick={createNewProject}
                className="cursor-pointer rounded-[3px] border border-accent bg-accent px-3 py-2 text-[12px] text-white"
              >
                Opret
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingProject(false);
                  setNewProjectName("");
                }}
                className="cursor-pointer text-[12px] text-mid hover:text-ink"
              >
                Annullér
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingProject(true)}
              className="cursor-pointer rounded-[3px] border border-dashed border-border bg-transparent px-3 py-2 text-[12px] text-light hover:border-accent hover:text-accent-bright"
            >
              + Nyt projekt
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border-light pt-4">
        <div>
          <Label>
            Arbejdsnoter <span className="ml-1 italic text-dim">— valgfri</span>
          </Label>
          <textarea
            value={day.workNotes}
            onChange={(e) => setDay({ ...day, workNotes: e.target.value })}
            rows={3}
            placeholder="Hvad arbejdede du med? Detaljer, beslutninger, frustrationer."
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Gik godt</Label>
            <textarea
              value={day.wentWell}
              onChange={(e) => setDay({ ...day, wentWell: e.target.value })}
              rows={2}
              placeholder="Selv små ting tæller."
            />
          </div>
          <div>
            <Label>Næste skridt</Label>
            <textarea
              value={day.nextStep}
              onChange={(e) => setDay({ ...day, nextStep: e.target.value })}
              rows={2}
              placeholder="Hvad starter du med i morgen?"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Jobsøgning -------------------------------------------------------------

function ApplicationsList({
  apps,
  onChange,
  date,
  unattachedDocs,
  setUnattachedDocs,
  onError,
}: {
  apps: AppItem[];
  onChange: (apps: AppItem[]) => void;
  date: string;
  unattachedDocs: AppDoc[];
  setUnattachedDocs: (
    next: AppDoc[] | ((prev: AppDoc[]) => AppDoc[]),
  ) => void;
  onError: (msg: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedDocsFor, setExpandedDocsFor] = useState<number | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<Status>("sent");
  const [, startAdd] = useTransition();

  function reset() {
    setCompany("");
    setRole("");
    setStatus("sent");
  }

  function add() {
    if (!company.trim()) return;
    startAdd(async () => {
      const res = await createJobApplication({
        company,
        role: role || null,
        files: null,
        status,
        sentAt: date,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      if (res.application) {
        onChange([
          ...apps,
          {
            id: res.application.id,
            company: res.application.company,
            role: res.application.role ?? "",
            files: res.application.files ?? "",
            status: res.application.status as Status,
            documents: [],
          },
        ]);
      }
      reset();
      setDialogOpen(false);
    });
  }

  async function remove(id: number) {
    onChange(apps.filter((a) => a.id !== id));
    await deleteJobApplication(id);
  }

  async function changeStatus(id: number, newStatus: Status) {
    onChange(apps.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
    await updateJobApplicationStatus({ id, status: newStatus });
  }

  return (
    <div>
      {apps.length === 0 ? (
        <div className="py-2 text-sm italic text-dim">Ingen ansøgninger endnu</div>
      ) : (
        <div className="space-y-2">
          {apps.map((a) => {
            const expanded = expandedDocsFor === a.id;
            return (
              <div
                key={a.id}
                className="rounded-[3px] border border-border-light bg-bg px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {a.company}
                      {a.role && <span className="text-mid"> · {a.role}</span>}
                    </div>
                    {a.files && (
                      <div className="mt-0.5">
                        <FileLinks value={a.files} />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDocsFor(expanded ? null : a.id)
                    }
                    className="cursor-pointer text-[11px] text-light hover:text-accent-bright"
                    title="Dokumenter"
                  >
                    📎 {a.documents.length}
                  </button>
                  <select
                    value={a.status}
                    onChange={(e) =>
                      changeStatus(a.id, e.target.value as Status)
                    }
                    className={`!w-auto !border-0 !p-1 !text-[11px] uppercase tracking-[0.3px] !rounded-full ${STATUS_CLASSES[a.status]}`}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k} className="bg-card text-ink">
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="cursor-pointer border-none bg-transparent px-1 text-[18px] leading-none text-dim hover:text-danger"
                    title="Fjern"
                  >
                    ×
                  </button>
                </div>
                {expanded && (
                  <div className="mt-2 border-t border-border-light pt-2">
                    <ApplicationDocuments
                      applicationId={a.id}
                      attached={a.documents}
                      availableForAttach={unattachedDocs}
                      compact
                      onChange={(next) => {
                        const added = next.filter(
                          (d) => !a.documents.some((x) => x.id === d.id),
                        );
                        const removed = a.documents.filter(
                          (d) => !next.some((x) => x.id === d.id),
                        );
                        onChange(
                          apps.map((x) =>
                            x.id === a.id ? { ...x, documents: next } : x,
                          ),
                        );
                        setUnattachedDocs((prev) => {
                          const filtered = prev.filter(
                            (d) => !added.some((x) => x.id === d.id),
                          );
                          return [...filtered, ...removed];
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!dialogOpen ? (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-3 w-full cursor-pointer rounded-[3px] border border-dashed border-border bg-bg p-2.5 text-sm text-light transition hover:border-accent hover:bg-accent-bg hover:text-accent-bright"
        >
          + Tilføj ansøgning
        </button>
      ) : (
        <div className="mt-3 border-t border-border-light pt-3">
          <div className="mb-3">
            <Label>Firma</Label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Fx Ravnit"
              autoFocus
            />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <Label>Stilling</Label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Fx Webudvikler"
              />
            </div>
            <div>
              <Label>Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mb-3 text-[11px] italic text-dim">
            Tilknyt CV/ansøgning/job-opslag efter du har oprettet ansøgningen
            — tryk på 📎-ikonet på rækken.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white transition hover:bg-accent-bright"
            >
              Tilføj
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setDialogOpen(false);
              }}
              className="cursor-pointer rounded-[3px] border border-border bg-transparent px-4 py-2 text-[13px] text-mid transition hover:border-accent-dim hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helbred ----------------------------------------------------------------

function HealthBody({
  day,
  setDay,
  sleepInput,
  setSleepInput,
  garminSleep,
  date,
  trackers,
  customParameters,
  customValues,
}: {
  day: DayState;
  setDay: (d: DayState) => void;
  sleepInput: string;
  setSleepInput: (s: string) => void;
  garminSleep: {
    durationMin: number | null;
    score: number | null;
    qualityLabel: string | null;
  } | null;
  date: string;
  trackers: TrackerRef[];
  customParameters: CustomParamSummary[];
  customValues: CustomValueRow[];
}) {
  const hasGarminDuration =
    garminSleep !== null && garminSleep.durationMin !== null;
  const hasGarminScore = garminSleep !== null && garminSleep.score !== null;
  const garminHoursText = hasGarminDuration
    ? `${Math.floor(garminSleep!.durationMin! / 60)}t ${String(garminSleep!.durationMin! % 60).padStart(2, "0")}m`
    : null;
  const garminQualityValue = hasGarminScore
    ? garminScoreToQuality(garminSleep!.score)
    : null;

  // Lokal tekst-state for decimaler — så "78," ikke forsvinder mens du
  // taster det næste ciffer (numerisk state mister komma-tilstanden).
  const [weightInput, setWeightInput] = useState(
    day.weightX10 === null
      ? ""
      : (day.weightX10 / 10).toString().replace(".", ","),
  );
  const [waistInput, setWaistInput] = useState(
    day.waistX10 === null
      ? ""
      : (day.waistX10 / 10).toString().replace(".", ","),
  );

  const kcal =
    day.carbsG !== null && day.proteinG !== null && day.fatG !== null
      ? day.carbsG * 4 + day.proteinG * 4 + day.fatG * 9
      : null;

  return (
    <div>
      <FieldSection icon={<Moon className="size-3.5" />} title="Søvn">
        <FieldRow label="Varighed" hint={hasGarminDuration ? "Garmin" : undefined}>
          {hasGarminDuration ? (
            <span className="text-[13px] text-mid">{garminHoursText}</span>
          ) : (
            <CompactNumberInput
              value={sleepInput}
              onChange={setSleepInput}
              unit="t"
              placeholder="Fx 7,5"
            />
          )}
        </FieldRow>
        <FieldRow label="Kvalitet" hint={hasGarminScore ? "Garmin" : undefined}>
          <SleepQualityScale
            value={hasGarminScore ? garminQualityValue : day.sleepQuality}
            onChange={(v) => setDay({ ...day, sleepQuality: v })}
            disabled={hasGarminScore}
          />
        </FieldRow>
      </FieldSection>

      <FieldSection icon={<Smile className="size-3.5" />} title="Stemning">
        <FieldRow label="Humør">
          <Scale1to5
            value={day.mood}
            onChange={(v) => setDay({ ...day, mood: v })}
          />
        </FieldRow>
        <FieldRow label="Energi">
          <Scale1to5
            value={day.energy}
            onChange={(v) => setDay({ ...day, energy: v })}
          />
        </FieldRow>
      </FieldSection>

      <FieldSection icon={<ScaleIcon className="size-3.5" />} title="Krop">
        <FieldRow label="Vægt">
          <CompactNumberInput
            value={weightInput}
            onChange={(raw) => {
              setWeightInput(raw);
              const t = raw.trim().replace(",", ".");
              if (t === "") {
                setDay({ ...day, weightX10: null });
                return;
              }
              const n = Number(t);
              if (Number.isFinite(n) && n >= 0 && n <= 500) {
                setDay({ ...day, weightX10: Math.round(n * 10) });
              }
            }}
            unit="kg"
            placeholder="78,5"
          />
        </FieldRow>
        <FieldRow label="Livvidde">
          <CompactNumberInput
            value={waistInput}
            onChange={(raw) => {
              setWaistInput(raw);
              const t = raw.trim().replace(",", ".");
              if (t === "") {
                setDay({ ...day, waistX10: null });
                return;
              }
              const n = Number(t);
              if (Number.isFinite(n) && n >= 0 && n <= 300) {
                setDay({ ...day, waistX10: Math.round(n * 10) });
              }
            }}
            unit="cm"
            placeholder="89,5"
          />
        </FieldRow>
      </FieldSection>

      <FieldSection
        icon={<Apple className="size-3.5" />}
        title="Ernæring"
        meta={kcal !== null ? `${kcal} kcal` : undefined}
      >
        <FieldRow label="Kulhydrat">
          <CompactNumberInput
            value={day.carbsG === null ? "" : String(day.carbsG)}
            onChange={(v) => {
              const t = v.trim();
              if (t === "") return setDay({ ...day, carbsG: null });
              const n = Number(t);
              if (Number.isFinite(n) && n >= 0 && n <= 2000) {
                setDay({ ...day, carbsG: Math.floor(n) });
              }
            }}
            unit="g"
            placeholder="0"
          />
        </FieldRow>
        <FieldRow label="Protein">
          <CompactNumberInput
            value={day.proteinG === null ? "" : String(day.proteinG)}
            onChange={(v) => {
              const t = v.trim();
              if (t === "") return setDay({ ...day, proteinG: null });
              const n = Number(t);
              if (Number.isFinite(n) && n >= 0 && n <= 1000) {
                setDay({ ...day, proteinG: Math.floor(n) });
              }
            }}
            unit="g"
            placeholder="0"
          />
        </FieldRow>
        <FieldRow label="Fedt">
          <CompactNumberInput
            value={day.fatG === null ? "" : String(day.fatG)}
            onChange={(v) => {
              const t = v.trim();
              if (t === "") return setDay({ ...day, fatG: null });
              const n = Number(t);
              if (Number.isFinite(n) && n >= 0 && n <= 1000) {
                setDay({ ...day, fatG: Math.floor(n) });
              }
            }}
            unit="g"
            placeholder="0"
          />
        </FieldRow>
      </FieldSection>

      <FieldSection icon={<Activity className="size-3.5" />} title="Aktivitet">
        <FieldRow label="Træning">
          <YesNoButtons
            value={day.didExercise}
            onChange={(v) =>
              setDay({
                ...day,
                didExercise: v,
                exerciseIntensity: v ? day.exerciseIntensity : null,
              })
            }
          />
        </FieldRow>
        {day.didExercise && (
          <FieldRow label="Intensitet" indent>
            <IntensityPicker
              value={day.exerciseIntensity}
              onChange={(v) => setDay({ ...day, exerciseIntensity: v })}
            />
          </FieldRow>
        )}
        <FieldRow label="Alkohol">
          <CompactNumberInput
            value={day.alcoholUnits === null ? "" : String(day.alcoholUnits)}
            onChange={(v) => {
              const t = v.trim();
              if (t === "") return setDay({ ...day, alcoholUnits: null });
              const n = Number(t);
              if (Number.isFinite(n) && n >= 0 && n <= 50) {
                setDay({ ...day, alcoholUnits: Math.floor(n) });
              }
            }}
            unit="×"
            placeholder="0"
          />
        </FieldRow>
      </FieldSection>

      {customParameters.length > 0 && (
        <FieldSection
          icon={<Sparkles className="size-3.5" />}
          title="Mine parametre"
        >
          <CustomParametersSection
            parameters={customParameters}
            date={date}
            initialValues={customValues}
          />
        </FieldSection>
      )}

      <FieldSection icon={<Pencil className="size-3.5" />} title="Helbredsnoter">
        <textarea
          value={day.healthNotes}
          onChange={(e) => setDay({ ...day, healthNotes: e.target.value })}
          rows={3}
          placeholder="Symptomer, medicin, observationer..."
          className="!text-[13px]"
        />
      </FieldSection>

      <FieldSection icon={<Camera className="size-3.5" />} title="Fotos">
        <TrackerPhotoSection date={date} trackers={trackers} />
      </FieldSection>
    </div>
  );
}

function Macros({
  day,
  setDay,
}: {
  day: DayState;
  setDay: (d: DayState) => void;
}) {
  const hasAll =
    day.carbsG !== null && day.proteinG !== null && day.fatG !== null;
  const hasPartial =
    !hasAll &&
    (day.carbsG !== null || day.proteinG !== null || day.fatG !== null);
  const kcal = hasAll
    ? (day.carbsG ?? 0) * 4 + (day.proteinG ?? 0) * 4 + (day.fatG ?? 0) * 9
    : null;
  return (
    <div className="rounded-[3px] border border-border-light bg-bg p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-mid">Makronæring</span>
        {kcal !== null && (
          <span className="text-[12px] text-accent-bright">{kcal} kcal</span>
        )}
        {hasPartial && (
          <span className="text-[11px] italic text-dim">
            Udfyld alle tre for kcal
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MacroInput
          label="Kulhydrater"
          unit="g"
          value={day.carbsG}
          onChange={(n) => setDay({ ...day, carbsG: n })}
        />
        <MacroInput
          label="Protein"
          unit="g"
          value={day.proteinG}
          onChange={(n) => setDay({ ...day, proteinG: n })}
        />
        <MacroInput
          label="Fedt"
          unit="g"
          value={day.fatG}
          onChange={(n) => setDay({ ...day, fatG: n })}
        />
      </div>
    </div>
  );
}

function MacroInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value === null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") {
              onChange(null);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0 && n <= 2000) {
              onChange(Math.round(n));
            }
          }}
          placeholder="0"
          className="!pr-7"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-dim">
          {unit}
        </span>
      </div>
    </div>
  );
}

// --- Notater ----------------------------------------------------------------

// --- Kosttilskud ------------------------------------------------------------

const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "Morgen",
  midday: "Middag",
  evening: "Aften",
  night: "Nat",
};

function formatDose(amountX100: number | null, unit: string | null): string {
  if (amountX100 === null) return unit ?? "";
  const value = (amountX100 / 100).toString().replace(".", ",");
  return unit ? `${value} ${unit}` : value;
}

function parseDoseX100(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function isoToDatetimeLocal(iso: string): string {
  // Konverterer en ISO-UTC-streng til formatet datetime-local-input bruger
  // (lokal tid, ingen tidszone): "YYYY-MM-DDTHH:MM".
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string {
  // datetime-local er allerede i lokal tid. new Date() fortolker det som lokal.
  return new Date(value).toISOString();
}

function FastCard({
  initialActive,
  initialRecent,
  onError,
}: {
  initialActive: ActiveFast;
  initialRecent: RecentFast[];
  onError: (msg: string) => void;
}) {
  const [active, setActive] = useState<ActiveFast>(initialActive);
  const [recent, setRecent] = useState<RecentFast[]>(initialRecent);
  const [pending, startTx] = useTransition();
  // Ticks for live duration. Updates every 30s — granulært nok til minut-visning.
  const [now, setNow] = useState<number>(() => Date.now());
  const [manualMode, setManualMode] = useState(false);
  const [manualStart, setManualStart] = useState(() => isoToDatetimeLocal(new Date().toISOString()));
  const [editingStart, setEditingStart] = useState(false);
  const [editStartInput, setEditStartInput] = useState("");
  const [manualEndMode, setManualEndMode] = useState(false);
  const [manualEnd, setManualEnd] = useState("");

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [active]);

  function handleStartNow() {
    startTx(async () => {
      const res = await startFast();
      setActive({
        id: res.fast.id,
        startedAt: res.fast.startedAt,
        note: res.fast.note,
      });
      setNow(Date.now());
    });
  }

  function handleStartManual() {
    if (!manualStart) return;
    const iso = datetimeLocalToIso(manualStart);
    if (new Date(iso).getTime() > Date.now()) {
      onError("Start-tidspunkt kan ikke ligge i fremtiden.");
      return;
    }
    startTx(async () => {
      const res = await startFast();
      // Opdater til det manuelle tidspunkt
      const updateRes = await updateFast({ id: res.fast.id, startedAt: iso });
      if (!updateRes.ok) {
        onError(updateRes.error);
        return;
      }
      setActive({
        id: res.fast.id,
        startedAt: iso,
        note: res.fast.note,
      });
      setNow(Date.now());
      setManualMode(false);
    });
  }

  function handleEnd(endedAtIso?: string) {
    startTx(async () => {
      const res = await endFast(endedAtIso ? { endedAt: endedAtIso } : undefined);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      const ended: RecentFast = {
        id: res.fast.id,
        startedAt: res.fast.startedAt,
        endedAt: res.fast.endedAt,
        note: res.fast.note,
      };
      setRecent((xs) => [ended, ...xs.filter((f) => f.id !== ended.id)].slice(0, 5));
      setActive(null);
      setManualEndMode(false);
    });
  }

  function handleEndManual() {
    if (!active || !manualEnd) return;
    const iso = datetimeLocalToIso(manualEnd);
    const endMs = new Date(iso).getTime();
    if (endMs <= new Date(active.startedAt).getTime()) {
      onError("Slut-tidspunkt skal være efter start.");
      return;
    }
    if (endMs > Date.now()) {
      onError("Slut-tidspunkt kan ikke ligge i fremtiden.");
      return;
    }
    handleEnd(iso);
  }

  function handleSaveStartEdit() {
    if (!active || !editStartInput) return;
    const iso = datetimeLocalToIso(editStartInput);
    if (new Date(iso).getTime() > Date.now()) {
      onError("Start-tidspunkt kan ikke ligge i fremtiden.");
      return;
    }
    startTx(async () => {
      const res = await updateFast({ id: active.id, startedAt: iso });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      setActive({ ...active, startedAt: iso });
      setEditingStart(false);
      setNow(Date.now());
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("Slet denne faste-registrering?")) return;
    setRecent((xs) => xs.filter((f) => f.id !== id));
    await deleteFast(id);
  }

  if (active) {
    const mins = fastDurationMinutes(active.startedAt, null, now);
    const qualified = isQualifiedFast(mins);
    const minsUntilQualified = Math.max(0, FAST_QUALIFIED_MINUTES - mins);
    return (
      <div className="space-y-3">
        <div
          className={`rounded-[4px] border px-4 py-3 ${
            qualified
              ? "border-success bg-[rgba(74,222,128,0.08)]"
              : "border-accent-dim bg-accent-bg"
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`flex items-center gap-1.5 font-serif text-[15px] ${qualified ? "text-success" : "text-accent-bright"}`}
            >
              {qualified ? (
                <>
                  <Check className="size-4" />
                  Du faster — kvalificeret (16t+)
                </>
              ) : (
                <>
                  <Hourglass className="size-4" />
                  Du faster
                </>
              )}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-light">
              startede {formatTimestampShort(active.startedAt)}
              {!editingStart && (
                <button
                  type="button"
                  onClick={() => {
                    setEditStartInput(isoToDatetimeLocal(active.startedAt));
                    setEditingStart(true);
                  }}
                  className="cursor-pointer text-dim hover:text-accent-bright"
                  title="Redigér start-tidspunkt"
                >
                  <Pencil className="size-3" />
                </button>
              )}
            </span>
          </div>
          {editingStart && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={editStartInput}
                onChange={(e) => setEditStartInput(e.target.value)}
                className="!w-auto !py-1 text-[13px]"
              />
              <button
                type="button"
                onClick={handleSaveStartEdit}
                disabled={pending}
                className="cursor-pointer rounded-[3px] border border-accent bg-accent px-3 py-1 text-[12px] text-white disabled:opacity-50"
              >
                Gem
              </button>
              <button
                type="button"
                onClick={() => setEditingStart(false)}
                className="cursor-pointer text-[12px] text-mid hover:text-ink"
              >
                Annullér
              </button>
            </div>
          )}
          <div className="mt-1 font-serif text-[24px] text-ink">
            {formatFastDuration(mins)}
            {!qualified && (
              <span className="ml-3 text-[12px] italic text-mid">
                kvalificeret om {formatFastDuration(minsUntilQualified)}
              </span>
            )}
          </div>
        </div>
        {!manualEndMode ? (
          <>
            <button
              type="button"
              onClick={() => handleEnd()}
              disabled={pending}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[3px] border border-accent bg-accent px-4 py-2.5 text-[14px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              <Utensils className="size-4" />
              Bryder fasten nu
            </button>
            <button
              type="button"
              onClick={() => {
                setManualEnd(isoToDatetimeLocal(new Date().toISOString()));
                setManualEndMode(true);
              }}
              className="cursor-pointer text-[12px] text-light hover:text-accent-bright"
            >
              …eller indtast tidspunkt manuelt
            </button>
          </>
        ) : (
          <div className="rounded-[3px] border border-border-light bg-bg p-3">
            <label className="mb-1.5 block text-[12px] text-mid">
              Hvornår begyndte du at spise?
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                min={isoToDatetimeLocal(active.startedAt)}
                max={isoToDatetimeLocal(new Date().toISOString())}
                className="!w-auto !py-1.5 text-[13px]"
              />
              <button
                type="button"
                onClick={handleEndManual}
                disabled={pending}
                className="flex cursor-pointer items-center gap-2 rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
              >
                <Utensils className="size-4" />
                Bryd faste
              </button>
              <button
                type="button"
                onClick={() => setManualEndMode(false)}
                className="cursor-pointer text-[12px] text-mid hover:text-ink"
              >
                Annullér
              </button>
            </div>
          </div>
        )}
        <RecentFasts list={recent} onDelete={handleDelete} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!manualMode ? (
        <>
          <button
            type="button"
            onClick={handleStartNow}
            disabled={pending}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[3px] border border-accent bg-accent px-4 py-2.5 text-[14px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            <UtensilsCrossed className="size-4" />
            Stoppet med at spise nu
          </button>
          <button
            type="button"
            onClick={() => {
              setManualStart(isoToDatetimeLocal(new Date().toISOString()));
              setManualMode(true);
            }}
            className="cursor-pointer text-[12px] text-light hover:text-accent-bright"
          >
            …eller indtast tidspunkt manuelt
          </button>
        </>
      ) : (
        <div className="rounded-[3px] border border-border-light bg-bg p-3">
          <label className="mb-1.5 block text-[12px] text-mid">
            Hvornår stoppede du med at spise?
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              max={isoToDatetimeLocal(new Date().toISOString())}
              className="!w-auto !py-1.5 text-[13px]"
            />
            <button
              type="button"
              onClick={handleStartManual}
              disabled={pending}
              className="flex cursor-pointer items-center gap-2 rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              <UtensilsCrossed className="size-4" />
              Start faste
            </button>
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="cursor-pointer text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      )}
      <p className="text-[12px] italic text-dim">
        En faste tæller som “kvalificeret” når du har fastet mindst 16 timer.
      </p>
      <RecentFasts list={recent} onDelete={handleDelete} />
    </div>
  );
}

function RecentFasts({
  list,
  onDelete,
}: {
  list: RecentFast[];
  onDelete: (id: number) => void;
}) {
  if (list.length === 0) return null;
  return (
    <div className="space-y-1 border-t border-border-light pt-3">
      <div className="text-[11px] uppercase tracking-[0.4px] text-light">
        Seneste
      </div>
      {list.map((f) => {
        if (!f.endedAt) return null;
        const mins = fastDurationMinutes(f.startedAt, f.endedAt);
        const qualified = isQualifiedFast(mins);
        return (
          <div
            key={f.id}
            className="flex items-center gap-3 rounded-[3px] border border-border-light bg-bg px-3 py-1.5 text-[12px]"
          >
            {qualified ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Circle className="size-3.5 text-dim" />
            )}
            <span className="text-mid">
              {formatTimestampShort(f.startedAt)} → {formatTimestampShort(f.endedAt)}
            </span>
            <span
              className={`ml-auto font-medium ${qualified ? "text-success" : "text-mid"}`}
            >
              {formatFastDuration(mins)}
            </span>
            <button
              type="button"
              onClick={() => onDelete(f.id)}
              className="cursor-pointer text-dim hover:text-danger"
              title="Slet"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SupplementsBody({
  date,
  supplements,
  setSupplements,
  intakes,
  setIntakes,
  onError,
}: {
  date: string;
  supplements: SupplementDef[];
  setSupplements: (s: SupplementDef[] | ((prev: SupplementDef[]) => SupplementDef[])) => void;
  intakes: SupplementIntake[];
  setIntakes: (
    i: SupplementIntake[] | ((prev: SupplementIntake[]) => SupplementIntake[]),
  ) => void;
  onError: (msg: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customizing, setCustomizing] = useState<SupplementDef | null>(null);
  const [pending, startTx] = useTransition();

  function logWithValues(
    supplement: SupplementDef,
    values: {
      doseAmountX100: number | null;
      doseUnit: string | null;
      timeOfDay: TimeOfDay | null;
      note: string | null;
    },
  ) {
    startTx(async () => {
      const res = await logSupplementIntake({
        supplementId: supplement.id,
        date,
        doseAmountX100: values.doseAmountX100,
        doseUnit: values.doseUnit,
        timeOfDay: values.timeOfDay,
        note: values.note,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      if (res.intake) {
        setIntakes((prev) => [
          ...prev,
          {
            id: res.intake!.id,
            name: res.intake!.name,
            supplementId: res.intake!.supplementId,
            doseAmountX100: res.intake!.doseAmountX100,
            doseUnit: res.intake!.doseUnit,
            timeOfDay: res.intake!.timeOfDay as TimeOfDay | null,
            note: res.intake!.note,
          },
        ]);
      }
      setPicking(false);
      setCustomizing(null);
    });
  }

  async function removeIntake(id: number) {
    setIntakes((prev) => prev.filter((i) => i.id !== id));
    await deleteSupplementIntake(id);
  }

  async function removeSupplement(s: SupplementDef) {
    if (
      !confirm(
        `Slet "${s.name}" fra biblioteket? Tidligere registreringer påvirkes ikke — de er stadig bundet til navnet.`,
      )
    )
      return;
    setSupplements((prev) => prev.filter((x) => x.id !== s.id));
    await deleteSupplement(s.id);
  }

  return (
    <div className="space-y-3">
      {intakes.length === 0 ? (
        <p className="text-[13px] italic text-dim">Ingen tilskud logget i dag.</p>
      ) : (
        <div className="space-y-1.5">
          {intakes.map((i) => {
            const name = i.name || "Ukendt";
            const dose = formatDose(i.doseAmountX100, i.doseUnit);
            const time = i.timeOfDay ? TIME_OF_DAY_LABELS[i.timeOfDay] : null;
            return (
              <div
                key={i.id}
                className="flex items-center gap-3 rounded-[3px] border border-border-light bg-bg px-3 py-2 text-[13px]"
              >
                <span className="font-medium text-ink">{name}</span>
                {dose && (
                  <span className="text-accent-bright">{dose}</span>
                )}
                {time && (
                  <span className="text-[11px] uppercase tracking-[0.3px] text-light">
                    · {time}
                  </span>
                )}
                {i.note && (
                  <span
                    className="truncate text-[12px] italic text-mid"
                    title={i.note}
                  >
                    {i.note}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeIntake(i.id)}
                  className="ml-auto cursor-pointer px-1 text-dim hover:text-danger"
                  title="Fjern"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!picking && !creating && (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="cursor-pointer rounded-[3px] border border-dashed border-border bg-bg px-3 py-2 text-[13px] text-light hover:border-accent hover:text-accent-bright"
        >
          + Vælg tilskud
        </button>
      )}

      {picking && !customizing && (
        <div className="rounded-[3px] border border-accent-dim bg-bg p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-serif text-[13px] italic text-accent-bright">
              Vælg tilskud
            </span>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="cursor-pointer text-[11px] text-light hover:text-ink"
            >
              ✕
            </button>
          </div>
          {supplements.filter((s) => !s.archived).length === 0 ? (
            <p className="text-[12px] italic text-dim">
              Du har endnu ingen tilskud i dit bibliotek.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {supplements.filter((s) => !s.archived).map((s) => (
                <span
                  key={s.id}
                  className="group inline-flex items-center rounded-full border border-border bg-card text-[12px] text-mid hover:border-accent hover:text-accent-bright"
                >
                  <button
                    type="button"
                    onClick={() => setCustomizing(s)}
                    disabled={pending}
                    className="cursor-pointer rounded-l-full px-3 py-1 disabled:opacity-50"
                  >
                    {s.name}
                    {s.defaultDoseAmountX100 !== null && (
                      <span className="ml-1 text-dim">
                        {formatDose(s.defaultDoseAmountX100, s.defaultDoseUnit)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSupplement(s);
                    }}
                    className="cursor-pointer rounded-r-full px-2 py-1 text-dim opacity-50 hover:bg-bg hover:text-danger hover:opacity-100"
                    title={`Fjern ${s.name} fra biblioteket`}
                    aria-label={`Slet ${s.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setPicking(false);
              setCreating(true);
            }}
            className="mt-3 cursor-pointer text-[12px] text-accent-bright hover:underline"
          >
            + Opret nyt tilskud
          </button>
        </div>
      )}

      {customizing && (
        <CustomizeIntakeForm
          supplement={customizing}
          onCancel={() => setCustomizing(null)}
          onConfirm={(values) => logWithValues(customizing, values)}
          pending={pending}
        />
      )}

      {creating && (
        <NewSupplementForm
          date={date}
          onCancel={() => setCreating(false)}
          onCreated={(supp, intake) => {
            setSupplements((prev) => [...prev, supp]);
            if (intake) setIntakes((prev) => [...prev, intake]);
            setCreating(false);
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

function CustomizeIntakeForm({
  supplement,
  onCancel,
  onConfirm,
  pending,
}: {
  supplement: SupplementDef;
  onCancel: () => void;
  onConfirm: (values: {
    doseAmountX100: number | null;
    doseUnit: string | null;
    timeOfDay: TimeOfDay | null;
    note: string | null;
  }) => void;
  pending: boolean;
}) {
  const [doseInput, setDoseInput] = useState(
    supplement.defaultDoseAmountX100 === null
      ? ""
      : (supplement.defaultDoseAmountX100 / 100).toString().replace(".", ","),
  );
  const [unit, setUnit] = useState(supplement.defaultDoseUnit ?? "");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | "">(
    supplement.defaultTimeOfDay ?? "",
  );
  const [note, setNote] = useState("");

  function confirm() {
    onConfirm({
      doseAmountX100: parseDoseX100(doseInput),
      doseUnit: unit.trim() || null,
      timeOfDay: timeOfDay || null,
      note: note.trim() || null,
    });
  }

  return (
    <div className="rounded-[3px] border border-accent-dim bg-bg p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-serif text-[13px] italic text-accent-bright">
          Log {supplement.name}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-[11px] text-light hover:text-ink"
          title="Tilbage"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-light">Dosis</label>
          <input
            type="text"
            inputMode="decimal"
            value={doseInput}
            onChange={(e) => setDoseInput(e.target.value)}
            placeholder="fx 480"
            className="!w-20 !py-1.5 text-[13px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-light">Enhed</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="mg"
            className="!w-16 !py-1.5 text-[13px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-light">Tidspunkt</label>
          <select
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay | "")}
            className="!py-1.5 text-[13px]"
          >
            <option value="">—</option>
            <option value="morning">Morgen</option>
            <option value="midday">Middag</option>
            <option value="evening">Aften</option>
            <option value="night">Nat</option>
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[11px] text-light">
            Note (valgfri)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="…"
            className="!py-1.5 text-[13px]"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-1.5 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          Log
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-[3px] border border-border bg-transparent px-3 py-1.5 text-[12px] text-mid hover:border-accent-dim hover:text-ink"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}

function NewSupplementForm({
  date,
  onCancel,
  onCreated,
  onError,
}: {
  date: string;
  onCancel: () => void;
  onCreated: (supp: SupplementDef, intake: SupplementIntake | null) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [doseInput, setDoseInput] = useState("");
  const [unit, setUnit] = useState("mg");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | "">("");
  const [logToday, setLogToday] = useState(true);
  const [pending, startTx] = useTransition();

  function submit() {
    if (!name.trim()) {
      onError("Navn mangler.");
      return;
    }
    const doseX100 = parseDoseX100(doseInput);
    startTx(async () => {
      const res = await createSupplement({
        name,
        defaultDoseAmountX100: doseX100,
        defaultDoseUnit: unit.trim() || null,
        defaultTimeOfDay: timeOfDay || null,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      if (!res.supplement) return;
      const supp: SupplementDef = {
        id: res.supplement.id,
        name: res.supplement.name,
        defaultDoseAmountX100: res.supplement.defaultDoseAmountX100,
        defaultDoseUnit: res.supplement.defaultDoseUnit,
        defaultTimeOfDay: res.supplement.defaultTimeOfDay as TimeOfDay | null,
        archived: false,
      };

      let intake: SupplementIntake | null = null;
      if (logToday) {
        const logRes = await logSupplementIntake({
          supplementId: supp.id,
          date,
        });
        if (logRes.ok && logRes.intake) {
          intake = {
            id: logRes.intake.id,
            name: logRes.intake.name,
            supplementId: logRes.intake.supplementId,
            doseAmountX100: logRes.intake.doseAmountX100,
            doseUnit: logRes.intake.doseUnit,
            timeOfDay: logRes.intake.timeOfDay as TimeOfDay | null,
            note: logRes.intake.note,
          };
        }
      }
      onCreated(supp, intake);
    });
  }

  return (
    <div className="rounded-[3px] border border-accent-dim bg-bg p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-serif text-[13px] italic text-accent-bright">
          Nyt tilskud
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-[11px] text-light hover:text-ink"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-[12px] text-mid">Navn</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fx Glycine, D-vitamin..."
            autoFocus
            className="!py-1.5 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[12px] text-mid">Standard-dosis</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={doseInput}
              onChange={(e) => setDoseInput(e.target.value)}
              placeholder="3"
              className="!w-20 !py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-mid">Enhed</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="mg / g / μg / IU"
              className="!w-24 !py-1.5 text-[13px]"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-[12px] text-mid">Tidspunkt</label>
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay | "")}
              className="!py-1.5 text-[13px]"
            >
              <option value="">— (intet)</option>
              <option value="morning">Morgen</option>
              <option value="midday">Middag</option>
              <option value="evening">Aften</option>
              <option value="night">Nat</option>
            </select>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-mid">
          <input
            type="checkbox"
            checked={logToday}
            onChange={(e) => setLogToday(e.target.checked)}
            className="!w-auto"
          />
          Log straks for i dag
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="cursor-pointer rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            {pending ? "..." : "Opret"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[3px] border border-border bg-transparent px-3 py-1.5 text-[13px] text-mid hover:border-accent-dim hover:text-ink"
          >
            Annullér
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Primitiver -------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[13px] font-medium text-mid">{children}</label>
  );
}

function ExerciseIntensityToggle({
  value,
  onChange,
}: {
  value: "light" | "medium" | "hard" | null;
  onChange: (v: "light" | "medium" | "hard" | null) => void;
}) {
  const options: { v: "light" | "medium" | "hard"; label: string }[] = [
    { v: "light", label: "Let" },
    { v: "medium", label: "Mellem" },
    { v: "hard", label: "Hård" },
  ];
  return (
    <div className="flex gap-1.5">
      {options.map(({ v, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(active ? null : v)}
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
  );
}

function ToggleYesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[
        { label: "Ja", v: true },
        { label: "Nej", v: false },
      ].map(({ label, v }) => {
        const active = value === v;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(v)}
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
  const values = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);
  // Vi begrænser bredden af både knapperne OG hint-rækken til samme max-bredde
  // (max knapper × 38px + mellemrum), så "lavt/højt" flugter med tallene.
  const maxWidthPx = max * 38 + (max - 1) * 4;
  return (
    <div style={{ maxWidth: `${maxWidthPx}px` }}>
      <div className="flex items-center gap-1">
        {values.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(active ? null : n)}
              className={`aspect-square max-w-[38px] flex-1 cursor-pointer rounded-[3px] border text-[13px] font-medium transition ${
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
