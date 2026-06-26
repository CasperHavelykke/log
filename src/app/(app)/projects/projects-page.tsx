"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createProject, setFocusProject, setWeekGoal } from "../today/actions";
import { deleteProject, deleteTimeEntry, saveTimeEntry, updateProject } from "./actions";
import { ReflectionCard } from "./reflection-card";
import { danishLongDate, mondayOf, todayIsoDate, toIsoDate } from "@/lib/date";

type Project = { id: number; name: string; archived: boolean };
type Entry = {
  id: number;
  projectId: number;
  date: string;
  hoursX10: number;
  notes: string;
};
type Period = "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  week: "Denne uge",
  month: "Denne måned",
  all: "I alt",
};

function fmtHours(x10: number): string {
  return (x10 / 10).toString().replace(".", ",");
}
function parseHours(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 24) return null;
  return Math.round(n * 10);
}

export function ProjectsPage({
  focusProjectId,
  projects: initialProjects,
  entries: initialEntries,
  weekStart,
  weekFocusTargetX10,
  reflectionInitial,
}: {
  focusProjectId: number | null;
  projects: Project[];
  entries: Entry[];
  weekStart: string;
  weekFocusTargetX10: number | null;
  reflectionInitial: {
    date: string;
    workNotes: string;
    wentWell: string;
    nextStep: string;
  };
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [focusId, setFocusId] = useState<number | null>(focusProjectId);
  const [period, setPeriod] = useState<Period>("month");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === "week") return mondayOf(now);
    if (period === "month")
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return "0000-00-00";
  }, [period]);

  const statsByProject = useMemo(() => {
    const m = new Map<
      number,
      { periodX10: number; totalX10: number; lastDate: string | null; count: number }
    >();
    for (const p of projects)
      m.set(p.id, { periodX10: 0, totalX10: 0, lastDate: null, count: 0 });
    for (const e of entries) {
      const s = m.get(e.projectId);
      if (!s) continue;
      s.totalX10 += e.hoursX10;
      s.count += 1;
      if (e.date >= periodStart) s.periodX10 += e.hoursX10;
      if (!s.lastDate || e.date > s.lastDate) s.lastDate = e.date;
    }
    return m;
  }, [projects, entries, periodStart]);

  const periodTotal = useMemo(() => {
    let sum = 0;
    for (const s of statsByProject.values()) sum += s.periodX10;
    return sum;
  }, [statsByProject]);

  const visible = projects.filter((p) => showArchived || !p.archived);
  const archivedCount = projects.filter((p) => p.archived).length;

  async function handleCreateProject(name: string) {
    const res = await createProject({ name });
    if (res.ok && res.project) {
      setProjects((xs) => [...xs, { id: res.project!.id, name: res.project!.name, archived: false }]);
    } else if (!res.ok) {
      setError(res.error);
    }
    setAddingProject(false);
  }

  async function handleRename(id: number, name: string) {
    setProjects((xs) => xs.map((p) => (p.id === id ? { ...p, name } : p)));
    await updateProject({ id, name });
  }

  async function handleArchive(id: number, archived: boolean) {
    setProjects((xs) => xs.map((p) => (p.id === id ? { ...p, archived } : p)));
    await updateProject({ id, archived });
  }

  async function handleDeleteProject(id: number) {
    if (!confirm("Slet projektet og alle dets tidsregistreringer? Kan ikke fortrydes."))
      return;
    setProjects((xs) => xs.filter((p) => p.id !== id));
    setEntries((xs) => xs.filter((e) => e.projectId !== id));
    if (focusId === id) setFocusId(null);
    await deleteProject(id);
  }

  async function handleSetFocus(id: number) {
    setFocusId(id);
    await setFocusProject(id);
  }

  function applyEntry(saved: Entry | null, projectId: number, date: string) {
    setEntries((xs) => {
      const without = xs.filter(
        (e) => !(e.projectId === projectId && e.date === date),
      );
      return saved ? [saved, ...without] : without;
    });
  }

  async function handleDeleteEntry(id: number) {
    setEntries((xs) => xs.filter((e) => e.id !== id));
    await deleteTimeEntry(id);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8">
      <header className="mb-5 border-b border-hair pb-5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
          Projekter
        </div>
        <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
          Tidsregistrering
        </h1>
      </header>

      <FocusHoursBanner
        entries={entries}
        weekStart={weekStart}
        weekTargetX10={weekFocusTargetX10}
      />

      <div className="mb-5">
        <ReflectionCard
          date={reflectionInitial.date}
          initialWorkNotes={reflectionInitial.workNotes}
          initialWentWell={reflectionInitial.wentWell}
          initialNextStep={reflectionInitial.nextStep}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-hair pb-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Projekter
          </div>
          <div className="mt-0.5 font-serif text-[20px] leading-none text-ink">
            {fmtHours(periodTotal)} timer
            <span className="ml-2 text-[12px] italic text-light">
              {PERIOD_LABELS[period].toLowerCase()}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAddingProject(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Nyt projekt
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex shrink-0 gap-0.5 rounded-[8px] bg-bg p-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[6px] px-3 py-1 text-[12px] transition-colors ${
                period === p
                  ? "bg-accent text-white"
                  : "text-mid hover:text-ink"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {archivedCount > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-mid">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="!w-auto"
            />
            Vis arkiverede ({archivedCount})
          </label>
        )}
      </div>

      {addingProject && (
        <NewProjectModal
          onCancel={() => setAddingProject(false)}
          onCreate={handleCreateProject}
        />
      )}

      {error && (
        <div className="mb-4 rounded-[10px] border border-danger/40 bg-[var(--danger-soft)] px-4 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
          Opret dit første projekt med knappen ovenfor.
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isFocus={focusId === p.id}
              stats={
                statsByProject.get(p.id) ?? {
                  periodX10: 0,
                  totalX10: 0,
                  lastDate: null,
                  count: 0,
                }
              }
              periodLabel={PERIOD_LABELS[period].toLowerCase()}
              entries={entries
                .filter((e) => e.projectId === p.id)
                .sort((a, b) => (a.date < b.date ? 1 : -1))}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onRename={(name) => handleRename(p.id, name)}
              onArchive={(a) => handleArchive(p.id, a)}
              onDelete={() => handleDeleteProject(p.id)}
              onSetFocus={() => handleSetFocus(p.id)}
              onEntrySaved={(saved, date) => applyEntry(saved, p.id, date)}
              onEntryDeleted={handleDeleteEntry}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewProjectModal({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim());
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[400px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 font-serif text-[20px] text-ink">Nyt projekt</h3>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Navn
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Fx 'Loggen' eller 'Bachelorprojekt'"
          autoFocus
          className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[16px]"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink"
          >
            Annullér
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            Opret
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  isFocus,
  stats,
  periodLabel,
  entries,
  expanded,
  onToggle,
  onRename,
  onArchive,
  onDelete,
  onSetFocus,
  onEntrySaved,
  onEntryDeleted,
  onError,
}: {
  project: Project;
  isFocus: boolean;
  stats: { periodX10: number; totalX10: number; lastDate: string | null; count: number };
  periodLabel: string;
  entries: Entry[];
  expanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
  onSetFocus: () => void;
  onEntrySaved: (saved: Entry | null, date: string) => void;
  onEntryDeleted: (id: number) => void;
  onError: (msg: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);

  return (
    <div
      className={`group rounded-[10px] bg-bg-elevated shadow-[var(--shadow-card)] transition-colors ${
        project.archived ? "opacity-60" : ""
      } ${expanded ? "ring-1 ring-[var(--accent-soft-strong)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-dim">
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </span>
            {renaming ? (
              <input
                type="text"
                value={nameDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRename(nameDraft.trim() || project.name);
                    setRenaming(false);
                  }
                  if (e.key === "Escape") setRenaming(false);
                }}
                autoFocus
                className="!w-auto !rounded-[6px] !border-hair !bg-bg-subtle !py-1 !text-[14px]"
              />
            ) : (
              <span className="text-[14px] font-medium text-ink">
                {project.name}
              </span>
            )}
            {isFocus && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-accent">
                <Star className="size-3" strokeWidth={2.5} />
                Fokus
              </span>
            )}
            {project.archived && (
              <span className="rounded-full bg-[rgba(160,174,192,0.15)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-mid">
                Arkiveret
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-[11px] text-light">
            <span className="font-medium text-accent">
              {fmtHours(stats.periodX10)} t · {periodLabel}
            </span>
            <span>{fmtHours(stats.totalX10)} t i alt</span>
            {stats.lastDate && (
              <span>senest {danishLongDate(stats.lastDate)}</span>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {renaming ? (
            <button
              type="button"
              onClick={() => {
                onRename(nameDraft.trim() || project.name);
                setRenaming(false);
              }}
              className="cursor-pointer rounded-[6px] bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-bright"
            >
              Gem
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(project.name);
                setRenaming(true);
              }}
              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-mid hover:bg-bg hover:text-ink"
              title="Omdøb"
              aria-label="Omdøb"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {!isFocus && !project.archived && (
            <button
              type="button"
              onClick={onSetFocus}
              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-mid hover:bg-bg hover:text-accent"
              title="Sæt som fokus-projekt"
              aria-label="Sæt som fokus"
            >
              <Star className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onArchive(!project.archived)}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-mid hover:bg-bg hover:text-ink"
            title={project.archived ? "Genåbn" : "Arkivér"}
            aria-label={project.archived ? "Genåbn" : "Arkivér"}
          >
            {project.archived ? (
              <ArchiveRestore className="size-3.5" />
            ) : (
              <Archive className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:bg-bg hover:text-danger"
            title="Slet"
            aria-label="Slet"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-hair px-4 py-4">
          <TimeLog
            projectId={project.id}
            entries={entries}
            onSaved={onEntrySaved}
            onDeleted={onEntryDeleted}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

function TimeLog({
  projectId,
  entries,
  onSaved,
  onDeleted,
  onError,
}: {
  projectId: number;
  entries: Entry[];
  onSaved: (saved: Entry | null, date: string) => void;
  onDeleted: (id: number) => void;
  onError: (msg: string) => void;
}) {
  const [date, setDate] = useState(todayIsoDate());
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startSave] = useTransition();

  function save() {
    const x10 = parseHours(hours);
    if (x10 === null || x10 === 0) {
      onError("Skriv et gyldigt timetal.");
      return;
    }
    startSave(async () => {
      const res = await saveTimeEntry({ projectId, date, hoursX10: x10, notes: notes || null });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onSaved(
        res.entry
          ? {
              id: res.entry.id,
              projectId,
              date: res.entry.date,
              hoursX10: res.entry.hoursX10,
              notes: res.entry.notes ?? "",
            }
          : null,
        date,
      );
      setHours("");
      setNotes("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[8px] bg-bg p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Dato
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="!w-auto !rounded-[8px] !border-hair !bg-bg-subtle !px-3 !py-1.5 !text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Timer
            </label>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="2,5"
              className="!w-20 !rounded-[8px] !border-hair !bg-bg-subtle !px-3 !py-1.5 !text-[13px]"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Note (valgfri)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hvad lavede du?"
              className="!w-full !rounded-[8px] !border-hair !bg-bg-subtle !px-3 !py-1.5 !text-[13px]"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="cursor-pointer rounded-[8px] bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            {pending ? "…" : "Log tid"}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-[12px] italic text-light">Ingen tid logget endnu.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => (
            <div
              key={e.id}
              className="group flex items-center gap-3 rounded-[8px] bg-bg px-3 py-2 text-[13px]"
            >
              <span className="w-32 shrink-0 text-[12px] uppercase tracking-[0.3px] text-light">
                {danishLongDate(e.date)}
              </span>
              <span className="w-14 shrink-0 font-medium text-accent">
                {fmtHours(e.hoursX10)} t
              </span>
              <span className="min-w-0 flex-1 truncate text-mid">
                {e.notes || "—"}
              </span>
              <button
                type="button"
                onClick={() => onDeleted(e.id)}
                className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:bg-bg-subtle hover:text-danger"
                title="Slet registrering"
                aria-label="Slet registrering"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Focus-hours banner (samme stil som /jobs WeekGoalBanner) ---------------

function FocusHoursBanner({
  entries,
  weekStart,
  weekTargetX10,
}: {
  entries: Entry[];
  weekStart: string;
  weekTargetX10: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(
    weekTargetX10 !== null ? (weekTargetX10 / 10).toString().replace(".", ",") : "",
  );
  const [saving, startSave] = useTransition();

  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = toIsoDate(weekEndDate);

  const hoursThisWeekX10 = entries
    .filter((e) => e.date >= weekStart && e.date <= weekEnd)
    .reduce((sum, e) => sum + e.hoursX10, 0);
  const hoursThisWeek = hoursThisWeekX10 / 10;
  const target = weekTargetX10 !== null ? weekTargetX10 / 10 : 0;

  function openModal() {
    setInput(
      weekTargetX10 !== null
        ? (weekTargetX10 / 10).toString().replace(".", ",")
        : "",
    );
    setOpen(true);
  }

  function save() {
    const trimmed = input.trim().replace(",", ".");
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 240)) {
      return;
    }
    const x10 = value === null ? null : Math.round(value * 10);
    startSave(async () => {
      await setWeekGoal({
        weekStart,
        text: "",
        applicationsTarget: null,
        focusHoursTargetX10: x10,
      });
      setOpen(false);
      router.refresh();
    });
  }

  const banner =
    weekTargetX10 === null ? (
      <button
        type="button"
        onClick={openModal}
        className="mb-5 flex w-full items-center gap-3 rounded-[10px] border border-dashed border-hair-strong px-4 py-3 text-left text-[12px] italic text-light hover:border-accent hover:text-accent"
      >
        <span>Sæt et ugentligt mål for fokus-timer</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={openModal}
        title="Klik for at ændre mål"
        className="mb-5 flex w-full cursor-pointer flex-wrap items-center gap-3 rounded-[10px] border border-[var(--accent-soft-strong)] bg-gradient-to-r from-[var(--accent-bg)] to-transparent px-4 py-2.5 text-left transition-colors hover:bg-[var(--accent-bg)]"
      >
        <span className="text-[12px] text-mid">Ugens mål — fokus-timer:</span>
        <span className="font-serif text-[16px] text-ink">
          {hoursThisWeek.toFixed(1).replace(".", ",")}
          <span className="text-[13px] text-light">
            /{target.toString().replace(".", ",")}
          </span>
        </span>
        <div className="h-[5px] min-w-[140px] flex-1 overflow-hidden rounded-[4px] bg-bg">
          <div
            className="h-full rounded-[4px] bg-accent transition-all"
            style={{
              width: `${target > 0 ? Math.min(100, (hoursThisWeek / target) * 100) : 0}%`,
            }}
          />
        </div>
        <span className="text-[11px] italic text-light">
          {hoursThisWeek >= target
            ? "Målet er nået for denne uge"
            : `${(target - hoursThisWeek).toFixed(1).replace(".", ",")} timer tilbage`}
        </span>
      </button>
    );

  return (
    <>
      {banner}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-serif text-[20px] text-ink">
              Ugentligt mål — fokus-timer
            </h3>
            <p className="mb-4 text-[13px] text-mid">
              Hvor mange fokus-timer vil du registrere per uge?
            </p>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Timer per uge
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="fx 20"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setOpen(false);
              }}
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[16px]"
            />
            <p className="mt-2 text-[11px] italic text-light">
              Sæt til tomt for at fjerne målet.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink disabled:opacity-50"
              >
                Annullér
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
              >
                {saving ? "Gemmer…" : "Gem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
