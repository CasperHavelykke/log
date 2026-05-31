"use client";

import { useMemo, useState, useTransition } from "react";
import { createProject, setFocusProject } from "../today/actions";
import { deleteProject, deleteTimeEntry, saveTimeEntry, updateProject } from "./actions";
import { danishLongDate, mondayOf, todayIsoDate } from "@/lib/date";

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
}: {
  focusProjectId: number | null;
  projects: Project[];
  entries: Entry[];
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
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-serif text-[36px] font-medium leading-none text-ink">
            Projekter
          </h1>
          <p className="mt-1 font-serif text-sm italic text-mid">
            {fmtHours(periodTotal)} timer · {PERIOD_LABELS[period].toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddingProject(true)}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-bright"
        >
          + Nyt projekt
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`cursor-pointer rounded-[3px] border px-2.5 py-1 text-[12px] transition ${
                period === p
                  ? "border-accent bg-accent-bg text-accent-bright"
                  : "border-border bg-bg text-mid hover:border-accent-dim hover:text-ink"
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
        <NewProjectForm
          onCancel={() => setAddingProject(false)}
          onCreate={handleCreateProject}
        />
      )}

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-[rgba(248,113,113,0.1)] px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm italic text-dim">
          Opret dit første projekt øverst.
        </div>
      ) : (
        <div className="space-y-2">
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

function NewProjectForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="mb-4 flex gap-2 rounded-md border border-border bg-card p-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onCreate(name.trim());
        }}
        placeholder="Projektnavn"
        autoFocus
      />
      <button
        type="button"
        onClick={() => name.trim() && onCreate(name.trim())}
        className="cursor-pointer whitespace-nowrap rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
      >
        Opret
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer whitespace-nowrap rounded-[3px] border border-border bg-transparent px-4 py-2 text-[13px] text-mid hover:border-accent-dim hover:text-ink"
      >
        Annullér
      </button>
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
      className={`rounded-md border bg-card transition-colors ${
        project.archived ? "border-border-light opacity-70" : "border-border"
      } ${expanded ? "border-accent-dim" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-dim">{expanded ? "▾" : "▸"}</span>
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
                }}
                autoFocus
                className="!w-auto !py-1"
              />
            ) : (
              <span className="text-[15px] font-medium text-ink">{project.name}</span>
            )}
            {isFocus && (
              <span className="rounded-full bg-accent-bg px-2 py-0.5 text-[10px] uppercase tracking-[0.3px] text-accent-bright">
                Fokus
              </span>
            )}
            {project.archived && (
              <span className="rounded-full bg-[rgba(160,174,192,0.15)] px-2 py-0.5 text-[10px] uppercase tracking-[0.3px] text-mid">
                Arkiveret
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 pl-5 text-[12px] text-light">
            <span className="text-accent-bright">
              {fmtHours(stats.periodX10)} t · {periodLabel}
            </span>
            <span>{fmtHours(stats.totalX10)} t i alt</span>
            {stats.lastDate && <span>senest {danishLongDate(stats.lastDate)}</span>}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {renaming ? (
            <button
              type="button"
              onClick={() => {
                onRename(nameDraft.trim() || project.name);
                setRenaming(false);
              }}
              className="cursor-pointer rounded border border-accent bg-accent px-2 py-1 text-[12px] text-white"
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
              className="cursor-pointer rounded border border-transparent px-2 py-1 text-mid hover:border-border hover:bg-bg hover:text-ink"
              title="Omdøb"
            >
              ✎
            </button>
          )}
          {!isFocus && !project.archived && (
            <button
              type="button"
              onClick={onSetFocus}
              className="cursor-pointer rounded border border-transparent px-2 py-1 text-[12px] text-mid hover:border-border hover:bg-bg hover:text-accent-bright"
              title="Sæt som fokus-projekt"
            >
              ☆
            </button>
          )}
          <button
            type="button"
            onClick={() => onArchive(!project.archived)}
            className="cursor-pointer rounded border border-transparent px-2 py-1 text-[12px] text-mid hover:border-border hover:bg-bg hover:text-ink"
            title={project.archived ? "Genåbn" : "Arkivér"}
          >
            {project.archived ? "↑" : "⌹"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="cursor-pointer rounded border border-transparent px-2 py-1 text-dim hover:border-border hover:bg-bg hover:text-danger"
            title="Slet"
          >
            ×
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-light px-5 py-4">
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
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-light">Dato</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="!w-auto !py-1.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-light">Timer</label>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="2,5"
            className="!w-20 !py-1.5"
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-[11px] text-light">Note (valgfri)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hvad lavede du?"
            className="!py-1.5"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "..." : "Log tid"}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-[13px] italic text-dim">Ingen tid logget endnu.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-[3px] border border-border-light bg-bg px-3 py-2 text-[13px]"
            >
              <span className="w-28 shrink-0 text-light">{danishLongDate(e.date)}</span>
              <span className="w-14 shrink-0 font-medium text-accent-bright">
                {fmtHours(e.hoursX10)} t
              </span>
              <span className="min-w-0 flex-1 truncate text-mid">{e.notes || "—"}</span>
              <button
                type="button"
                onClick={() => onDeleted(e.id)}
                className="cursor-pointer px-1 text-dim hover:text-danger"
                title="Slet registrering"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
