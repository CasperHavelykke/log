"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createJobApplication,
  deleteJobApplication,
  updateJobApplication,
  updateJobApplicationStatus,
} from "../today/actions";
import { danishLongDate } from "@/lib/date";
import { ExternalLink, FileLinks } from "@/components/file-links";

type Status =
  | "sent"
  | "no_response"
  | "replied"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

type App = {
  id: number;
  company: string;
  role: string;
  status: Status;
  files: string;
  url: string;
  contactPerson: string;
  notes: string;
  applicationText: string;
  sentAt: string;
  updatedAt: string;
};

type Event = {
  id: number;
  applicationId: number;
  status: Status;
  occurredAt: string;
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

const STATUS_DOT: Record<Status, string> = {
  sent: "bg-accent-bright",
  no_response: "bg-mid",
  replied: "bg-warning",
  interview: "bg-success",
  offer: "bg-success",
  rejected: "bg-danger",
  withdrawn: "bg-mid",
};

const STATUS_ORDER: Status[] = [
  "sent",
  "no_response",
  "replied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

// Tragten er ikke lineær. Afvisning er stadig et SVAR (firmaet reagerede), så
// "rejected" tæller med i "Svar modtaget" men ikke i "Til samtale". "Tilbud"
// tæller selvsagt opad. "no_response" og "withdrawn" er IKKE svar fra firmaet.
const REPLY_STATUSES = new Set<Status>(["replied", "interview", "offer", "rejected"]);
const INTERVIEW_STATUSES = new Set<Status>(["interview", "offer"]);
const OFFER_STATUSES = new Set<Status>(["offer"]);
const REJECTED_STATUSES = new Set<Status>(["rejected"]);

// --- date helpers -----------------------------------------------------------

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
const DANISH_MONTHS_SHORT = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];
function shortMonthLabel(d: Date): string {
  return `${DANISH_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

function shortDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

type Period = "month" | "30d" | "90d" | "6m" | "12m" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  month: "Denne måned",
  "30d": "30 dage",
  "90d": "90 dage",
  "6m": "6 måneder",
  "12m": "12 måneder",
  all: "Alt",
};

function isoWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  // ISO 8601: Thursday of current week determines the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// ---------------------------------------------------------------------------

export function JobsPage({
  initial,
  events: initialEvents,
}: {
  initial: App[];
  events: Event[];
}) {
  const [apps, setApps] = useState<App[]>(initial);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Negative IDs til optimistiske events. Vi udleder nye IDs ud fra eksisterende
  // state (mindste id - 1) så de altid er unikke, også på tværs af re-renders.
  function addLocalEvent(applicationId: number, status: Status) {
    setEvents((xs) => {
      const lowest = xs.reduce((min, e) => (e.id < min ? e.id : min), 0);
      return [
        ...xs,
        {
          id: lowest - 1,
          applicationId,
          status,
          occurredAt: fmtIso(new Date()),
        },
      ];
    });
  }

  const counts = useMemo(() => {
    const c: Record<Status, number> = {
      sent: 0,
      no_response: 0,
      replied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    };
    for (const a of apps) c[a.status]++;
    return c;
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.company.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.notes.toLowerCase().includes(q)
      );
    });
  }, [apps, search, statusFilter]);

  const eventsByApp = useMemo(() => {
    const m = new Map<number, Event[]>();
    for (const e of events) {
      const arr = m.get(e.applicationId) ?? [];
      arr.push(e);
      m.set(e.applicationId, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        a.occurredAt === b.occurredAt ? a.id - b.id : a.occurredAt < b.occurredAt ? -1 : 1,
      );
    }
    return m;
  }, [events]);

  function handleStatusChange(id: number, newStatus: Status) {
    const prev = apps.find((a) => a.id === id)?.status;
    setApps((xs) => xs.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
    if (prev !== newStatus) addLocalEvent(id, newStatus);
    updateJobApplicationStatus({ id, status: newStatus });
  }

  function handleDelete(id: number) {
    if (!confirm("Slet denne ansøgning?")) return;
    setApps((xs) => xs.filter((a) => a.id !== id));
    setEvents((xs) => xs.filter((e) => e.applicationId !== id));
    deleteJobApplication(id);
  }

  function handleSaveEdit(updated: App, prevStatus: Status) {
    setApps((xs) => xs.map((a) => (a.id === updated.id ? updated : a)));
    setEditingId(null);
    if (prevStatus !== updated.status) addLocalEvent(updated.id, updated.status);
    updateJobApplication({
      id: updated.id,
      company: updated.company,
      role: updated.role || null,
      status: updated.status,
      files: updated.files || null,
      url: updated.url || null,
      contactPerson: updated.contactPerson || null,
      notes: updated.notes || null,
      applicationText: updated.applicationText || null,
      sentAt: updated.sentAt || null,
    });
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-serif text-[36px] font-medium leading-none text-ink">Job</h1>
          <p className="mt-1 font-serif text-sm italic text-mid">
            {apps.length === 0
              ? "Ingen ansøgninger endnu"
              : `${apps.length} ansøgning${apps.length === 1 ? "" : "er"} i alt`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-bright"
        >
          + Ny ansøgning
        </button>
      </header>

      {apps.length > 0 && <JobStats apps={apps} events={events} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg firma, stilling, noter..."
          className="!w-auto !min-w-[240px] flex-1"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          label="Alle"
          count={apps.length}
        />
        {STATUS_ORDER.map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            label={STATUS_LABELS[s]}
            count={counts[s]}
            statusColor={s}
          />
        ))}
      </div>

      {adding && (
        <div className="mb-4 rounded-md border border-border bg-card p-5">
          <AddForm
            onCancel={() => setAdding(false)}
            onAdded={(newApp) => {
              setApps((xs) => [newApp, ...xs]);
              addLocalEvent(newApp.id, newApp.status);
              setAdding(false);
            }}
            onError={setError}
          />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-[rgba(248,113,113,0.1)] px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm italic text-dim">
          {apps.length === 0
            ? "Tilføj din første ansøgning øverst."
            : "Ingen ansøgninger matcher dine filtre."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) =>
            editingId === a.id ? (
              <EditCard
                key={a.id}
                app={a}
                onSave={(updated) => handleSaveEdit(updated, a.status)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <RowCard
                key={a.id}
                app={a}
                timeline={eventsByApp.get(a.id) ?? []}
                onStatusChange={(s) => handleStatusChange(a.id, s)}
                onEdit={() => setEditingId(a.id)}
                onDelete={() => handleDelete(a.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// --- statistics -------------------------------------------------------------

function JobStats({ apps, events }: { apps: App[]; events: Event[] }) {
  const [period, setPeriod] = useState<Period>("month");

  const range = useMemo(() => {
    const today = new Date();
    const todayIso = fmtIso(today);
    if (period === "month") {
      return { start: fmtIso(new Date(today.getFullYear(), today.getMonth(), 1)), end: todayIso };
    }
    if (period === "30d") return { start: fmtIso(addDays(today, -29)), end: todayIso };
    if (period === "90d") return { start: fmtIso(addDays(today, -89)), end: todayIso };
    if (period === "6m") {
      const d = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return { start: fmtIso(d), end: todayIso };
    }
    if (period === "12m") {
      const d = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      return { start: fmtIso(d), end: todayIso };
    }
    const sent = apps.map((a) => a.sentAt).filter(Boolean).sort();
    return { start: sent[0] ?? todayIso, end: todayIso };
  }, [period, apps]);

  const cohort = useMemo(
    () => apps.filter((a) => a.sentAt && a.sentAt >= range.start && a.sentAt <= range.end),
    [apps, range],
  );

  const buckets = useMemo(() => {
    const start = parseIso(range.start);
    const end = parseIso(range.end);
    const span = Math.max(0, daysBetween(start, end)) + 1;
    // Ansøgninger er sparsom data (sjældent mere end 1/dag, ofte 0).
    // Standard er ugentlige stænger; for lange spænd (>120 dage) skiftes til måneder.
    const granularity: "week" | "month" = span > 120 ? "month" : "week";
    const result: {
      label: string;
      start: string;
      end: string;
      count: number;
    }[] = [];

    if (granularity === "month") {
      let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        result.push({
          label: shortMonthLabel(cursor),
          start: fmtIso(mStart),
          end: fmtIso(mEnd),
          count: 0,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    } else {
      // Ugentlige stænger — uger starter på mandage; den første spænd-stang kan
      // være afkortet hvis range.start ikke falder på en mandag.
      const firstMondayOffset = (start.getDay() + 6) % 7;
      let cursor = addDays(start, -firstMondayOffset);
      while (cursor <= end) {
        const bEnd = addDays(cursor, 6);
        // Klip til range så stænger ikke strækker sig udenfor.
        const clampedStart = cursor < start ? start : cursor;
        const clampedEnd = bEnd > end ? end : bEnd;
        result.push({
          label: String(isoWeekNumber(cursor)),
          start: fmtIso(clampedStart),
          end: fmtIso(clampedEnd),
          count: 0,
        });
        cursor = addDays(cursor, 7);
      }
    }

    for (const a of cohort) {
      const b = result.find((x) => a.sentAt >= x.start && a.sentAt <= x.end);
      if (b) b.count++;
    }
    return { items: result, granularity };
  }, [cohort, range]);

  const funnel = useMemo(() => {
    const cohortIds = new Set(cohort.map((a) => a.id));
    const reached = (statuses: Set<Status>) => {
      const ids = new Set<number>();
      for (const e of events) {
        if (!cohortIds.has(e.applicationId)) continue;
        if (statuses.has(e.status)) ids.add(e.applicationId);
      }
      return ids.size;
    };
    return {
      sent: cohort.length,
      replied: reached(REPLY_STATUSES),
      interview: reached(INTERVIEW_STATUSES),
      offer: reached(OFFER_STATUSES),
      rejected: reached(REJECTED_STATUSES),
    };
  }, [cohort, events]);

  const maxBar = Math.max(1, ...buckets.items.map((b) => b.count));
  const labelEvery = Math.ceil(buckets.items.length / 16);

  return (
    <div className="mb-6 rounded-md border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-[20px] font-medium text-accent-bright">Statistik</h2>
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
      </div>

      <div className="mb-2 text-[12px] text-light">
        {cohort.length} ansøgning{cohort.length === 1 ? "" : "er"} sendt ·{" "}
        {shortDate(range.start)}–{shortDate(range.end)}
      </div>

      {/* Bar chart */}
      <div className="mb-5 flex h-[120px] items-stretch gap-[2px]">
        {buckets.items.map((b, i) => (
          <div
            key={i}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <div
              className="w-full rounded-t-[2px] bg-accent transition-all hover:bg-accent-bright"
              style={{
                height: `${(b.count / maxBar) * 100}%`,
                minHeight: b.count > 0 ? 3 : 0,
              }}
              title={`${b.count} ansøgning${b.count === 1 ? "" : "er"} · ${
                buckets.granularity === "month"
                  ? `Måned: ${b.label}`
                  : `Uge ${b.label} · ${shortDate(b.start)}–${shortDate(b.end)}`
              }`}
            />
          </div>
        ))}
      </div>
      <div className="mb-5 flex gap-[2px]">
        {buckets.items.map((b, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[9px] text-dim"
            style={{ visibility: i % labelEvery === 0 ? "visible" : "hidden" }}
          >
            {b.label}
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="space-y-1.5">
        {[
          { label: "Sendt", value: funnel.sent, color: "var(--accent)" },
          { label: "Svar modtaget", value: funnel.replied, color: "var(--warning)" },
          { label: "Til samtale", value: funnel.interview, color: "var(--success)" },
          { label: "Tilbud", value: funnel.offer, color: "var(--success)" },
          { label: "Afvist", value: funnel.rejected, color: "var(--danger)" },
        ].map((stage) => {
          const pct = funnel.sent > 0 ? (stage.value / funnel.sent) * 100 : 0;
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-[12px] text-mid">{stage.label}</div>
              <div className="relative h-6 flex-1 overflow-hidden rounded-[3px] bg-bg">
                <div
                  className="flex h-full items-center rounded-[3px] px-2 text-[11px] font-medium text-white transition-all"
                  style={{
                    width: `${Math.max(pct, stage.value > 0 ? 8 : 0)}%`,
                    background: stage.color,
                  }}
                >
                  {stage.value > 0 && stage.value}
                </div>
              </div>
              <div className="w-12 shrink-0 text-right text-[12px] text-light">
                {Math.round(pct)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ events }: { events: Event[] }) {
  if (events.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {events.map((e, i) => (
        <span key={e.id} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-dim">›</span>}
          <span className="flex items-center gap-1 text-[11px]">
            <span className={`size-1.5 rounded-full ${STATUS_DOT[e.status]}`} />
            <span className="text-mid">{STATUS_LABELS[e.status]}</span>
            <span className="text-dim">{shortDate(e.occurredAt)}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

// --- cards ------------------------------------------------------------------

function FilterChip({
  active,
  onClick,
  label,
  count,
  statusColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  statusColor?: Status;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] transition ${
        active
          ? statusColor
            ? `border-transparent ${STATUS_CLASSES[statusColor]}`
            : "border-accent bg-accent text-white"
          : "border-border bg-card text-mid hover:border-accent-dim hover:text-ink"
      }`}
    >
      {label}{" "}
      <span className={active ? "opacity-80" : "text-dim"}>{count}</span>
    </button>
  );
}

function RowCard({
  app,
  timeline,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  app: App;
  timeline: Event[];
  onStatusChange: (s: Status) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-5 py-4 transition-colors hover:border-accent-dim">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-ink">
            {app.company}
            {app.role && <span className="text-mid"> · {app.role}</span>}
          </div>
          {app.files && (
            <div className="mt-1">
              <FileLinks value={app.files} />
            </div>
          )}
          {app.url && (
            <div className="mt-0.5">
              <ExternalLink href={app.url} />
            </div>
          )}
          {timeline.length > 1 ? (
            <Timeline events={timeline} />
          ) : (
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.3px] text-light">
              {app.sentAt && <span>Sendt {danishLongDate(app.sentAt)}</span>}
            </div>
          )}
          {app.contactPerson && (
            <div className="mt-1 text-[11px] uppercase tracking-[0.3px] text-light">
              {app.contactPerson}
            </div>
          )}
          {app.notes && (
            <div className="mt-2 line-clamp-2 whitespace-pre-wrap text-[13px] text-mid">
              {app.notes}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={app.status}
            onChange={(e) => onStatusChange(e.target.value as Status)}
            className={`!w-auto !border-0 !p-1.5 !text-[11px] uppercase tracking-[0.3px] !rounded-full ${STATUS_CLASSES[app.status]}`}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s} className="bg-card text-ink">
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer rounded border border-transparent px-2 py-1 text-mid hover:border-border hover:bg-bg hover:text-ink"
            title="Redigér"
          >
            ✎
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
    </div>
  );
}

function EditCard({
  app,
  onSave,
  onCancel,
}: {
  app: App;
  onSave: (updated: App) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<App>(app);
  return (
    <div className="rounded-md border border-accent bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between border-b border-border-light pb-2">
        <h3 className="font-serif text-[18px] text-accent-bright">Redigér ansøgning</h3>
        <span className="text-[11px] uppercase tracking-[0.3px] text-light">
          Sidst opdateret {new Date(app.updatedAt).toLocaleString("da-DK")}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Firma">
          <input
            type="text"
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
          />
        </Field>
        <Field label="Stilling">
          <input
            type="text"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sendt-dato">
          <input
            type="date"
            value={draft.sentAt}
            onChange={(e) => setDraft({ ...draft, sentAt: e.target.value })}
          />
        </Field>
        <Field label="Filer" full>
          <input
            type="text"
            value={draft.files}
            onChange={(e) => setDraft({ ...draft, files: e.target.value })}
            placeholder="Fx CV_Ravnit.pdf, Ansøgning_Ravnit.pdf"
          />
        </Field>
        <Field label="URL" full>
          <input
            type="text"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="Link til opslaget"
          />
        </Field>
        <Field label="Kontaktperson" full>
          <input
            type="text"
            value={draft.contactPerson}
            onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })}
          />
        </Field>
        <Field label="Noter" full>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Indtryk, opfølgning, hvad du skal gøre næste gang..."
          />
        </Field>
        <Field
          label="Ansøgningstekst"
          full
          hint="Paste indholdet af ansøgningen — så kan Claude søge i den og finde inspiration på tværs af dine tidligere ansøgninger."
        >
          <textarea
            value={draft.applicationText}
            onChange={(e) =>
              setDraft({ ...draft, applicationText: e.target.value })
            }
            placeholder="Selve brevteksten — fri form. Kan være tomt."
            rows={10}
          />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          Gem ændringer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-[3px] border border-border bg-transparent px-4 py-2 text-[13px] text-mid hover:border-accent-dim hover:text-ink"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}

function AddForm({
  onAdded,
  onCancel,
  onError,
}: {
  onAdded: (app: App) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<Status>("sent");
  const [files, setFiles] = useState("");
  const [url, setUrl] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [applicationText, setApplicationText] = useState("");
  const [sentAt, setSentAt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [pending, startAdd] = useTransition();

  function submit() {
    if (!company.trim()) {
      onError("Firma skal udfyldes.");
      return;
    }
    startAdd(async () => {
      const res = await createJobApplication({
        company,
        role: role || null,
        files: files || null,
        applicationText: applicationText || null,
        status,
        sentAt: sentAt || undefined,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      if (res.application) {
        const extra = url || contactPerson || notes;
        if (extra) {
          await updateJobApplication({
            id: res.application.id,
            url: url || null,
            contactPerson: contactPerson || null,
            notes: notes || null,
          });
        }
        onAdded({
          id: res.application.id,
          company: res.application.company,
          role: res.application.role ?? "",
          status: res.application.status as Status,
          files: res.application.files ?? "",
          url,
          contactPerson,
          notes,
          applicationText,
          sentAt: res.application.sentAt ?? "",
          updatedAt: res.application.updatedAt,
        });
      }
    });
  }

  return (
    <div>
      <h3 className="mb-3 font-serif text-[18px] text-accent-bright">Ny ansøgning</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Firma">
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Fx Ravnit"
            autoFocus
          />
        </Field>
        <Field label="Stilling">
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Fx Webudvikler"
          />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sendt-dato">
          <input
            type="date"
            value={sentAt}
            onChange={(e) => setSentAt(e.target.value)}
          />
        </Field>
        <Field label="Filer" full>
          <input
            type="text"
            value={files}
            onChange={(e) => setFiles(e.target.value)}
            placeholder="Fx CV_Ravnit.pdf"
          />
        </Field>
        <Field label="URL" full>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Field label="Kontaktperson" full>
          <input
            type="text"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
        </Field>
        <Field label="Noter" full>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field
          label="Ansøgningstekst"
          full
          hint="Paste indholdet af ansøgningen — så kan Claude søge i den og finde inspiration på tværs af dine tidligere ansøgninger."
        >
          <textarea
            value={applicationText}
            onChange={(e) => setApplicationText(e.target.value)}
            placeholder="Selve brevteksten — fri form. Kan være tomt."
            rows={10}
          />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Tilføjer..." : "Tilføj"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-[3px] border border-border bg-transparent px-4 py-2 text-[13px] text-mid hover:border-accent-dim hover:text-ink"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  hint?: string;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-[13px] font-medium text-mid">
        {label}
      </label>
      {hint && <p className="mb-1.5 text-[11px] italic text-dim">{hint}</p>}
      {children}
    </div>
  );
}
