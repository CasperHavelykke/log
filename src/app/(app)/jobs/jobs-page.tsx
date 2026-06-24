"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createJobApplication,
  deleteJobApplication,
  setWeekGoal,
  updateJobApplication,
  updateJobApplicationStatus,
} from "../today/actions";
import { endJobSearchPeriod } from "./period-actions";
import { danishLongDate } from "@/lib/date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, FileLinks } from "@/components/file-links";
import { ApplicationDocuments } from "@/components/application-documents";
import { Check, Paperclip, Pencil, Plus, X } from "lucide-react";
import { formatDanishDate } from "@/lib/date";

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
  documents: AppDoc[];
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

type Period = "30d" | "90d" | "6m" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "30d": "30d",
  "90d": "90d",
  "6m": "6m",
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

type PeriodOption = {
  id: number;
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
};

export function JobsPage({
  initial,
  events: initialEvents,
  unattached: initialUnattached,
  periods,
  selectedPeriod,
  showingAll,
  weekTarget,
  weekStart,
}: {
  initial: App[];
  events: Event[];
  unattached: AppDoc[];
  periods: PeriodOption[];
  selectedPeriod: PeriodOption | null;
  showingAll: boolean;
  weekTarget: number | null;
  weekStart: string;
}) {
  const [apps, setApps] = useState<App[]>(initial);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [unattached, setUnattached] = useState<AppDoc[]>(initialUnattached);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [adding, setAdding] = useState(false);
  const [endingPeriod, setEndingPeriod] = useState(false);
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

  const periodTitle = showingAll
    ? "Alle ansøgninger"
    : (selectedPeriod?.name ??
      (selectedPeriod
        ? `Periode fra ${formatDanishDate(selectedPeriod.startedAt)}`
        : "Ingen aktiv periode"));
  const periodDateRange = selectedPeriod
    ? `${formatDanishDate(selectedPeriod.startedAt)} – ${selectedPeriod.endedAt ? formatDanishDate(selectedPeriod.endedAt) : "i dag"}`
    : null;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-hair pb-5">
        <div className="min-w-0">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Job
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            {periodTitle}
          </h1>
          {periodDateRange && !showingAll && (
            <div className="mt-1.5 text-[12px] italic text-light">
              {periodDateRange}
            </div>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          {selectedPeriod?.isActive && (
            <button
              type="button"
              onClick={() => setEndingPeriod(true)}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-bg-elevated px-3.5 py-2 text-[13px] text-mid hover:bg-bg-subtle hover:text-ink md:w-auto md:justify-start"
              title="Marker perioden som afsluttet (du har fundet et job)"
            >
              <Check className="size-3.5" />
              Afslut periode
            </button>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="hidden cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright md:inline-flex"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Ny ansøgning
          </button>
        </div>
      </header>

      {periods.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {periods.map((p) => {
            const active = !showingAll && selectedPeriod?.id === p.id;
            return (
              <Link
                key={p.id}
                href={`/jobs?period=${p.id}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors ${
                  active
                    ? "bg-accent-bg text-accent-bright"
                    : "bg-bg-elevated text-mid hover:bg-bg-subtle hover:text-ink"
                }`}
              >
                {p.isActive && (
                  <span className="inline-block size-1.5 rounded-full bg-success" />
                )}
                {p.name || formatDanishDate(p.startedAt)}
              </Link>
            );
          })}
          <Link
            href="/jobs?period=all"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors ${
              showingAll
                ? "bg-accent-bg text-accent-bright"
                : "bg-bg-elevated text-mid hover:bg-bg-subtle hover:text-ink"
            }`}
          >
            Alle
          </Link>
        </div>
      )}

      <WeekGoalBanner apps={apps} weekStart={weekStart} weekTarget={weekTarget} />

      {apps.length > 0 && (
        <>
          <StatRow apps={apps} events={events} />
          <JobStats apps={apps} events={events} />
        </>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg firma, stilling, noter..."
          className="!w-full !rounded-[8px] !border-hair !bg-bg-elevated !px-3 !py-2 !text-[13px] sm:!w-auto sm:!min-w-[280px] sm:!max-w-[360px] sm:flex-1"
        />
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
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
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto hidden cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-bright md:inline-flex"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Ny ansøgning
        </button>
      </div>

      {adding && (
        <AddForm
          onCancel={() => setAdding(false)}
          onAdded={(newApp) => {
            setApps((xs) => [newApp, ...xs]);
            addLocalEvent(newApp.id, newApp.status);
            setAdding(false);
          }}
          onError={setError}
        />
      )}

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-[rgba(248,113,113,0.1)] px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
          {apps.length === 0
            ? "Tilføj din første ansøgning øverst."
            : "Ingen ansøgninger matcher dine filtre."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((a) => (
              <RowCard
                key={a.id}
                app={a}
                timeline={eventsByApp.get(a.id) ?? []}
              />
          ))}
        </div>
      )}

      {/* FAB — kun synlig på mobil */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label="Ny ansøgning"
        className="fixed right-6 z-30 inline-flex size-14 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_12px_rgba(110,169,242,0.4),0_8px_24px_rgba(0,0,0,0.3)] transition-transform hover:bg-accent-bright active:translate-y-0.5 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 112px)" }}
      >
        <Plus className="size-6" strokeWidth={2.6} />
      </button>

      {endingPeriod && selectedPeriod && (
        <EndPeriodModal
          period={selectedPeriod}
          onClose={() => setEndingPeriod(false)}
        />
      )}
    </div>
  );
}

function EndPeriodModal({
  period,
  onClose,
}: {
  period: PeriodOption;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();

  function confirm() {
    startSave(async () => {
      const res = await endJobSearchPeriod();
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-[440px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--success-soft)] text-2xl">
            🎉
          </span>
          <div>
            <h3 className="font-serif text-[20px] text-ink">Tillykke!</h3>
            <p className="text-[12px] text-mid">
              {period.name ?? "Aktiv periode"} afsluttes
            </p>
          </div>
        </div>
        <div className="mb-5 space-y-2 text-[13px] text-mid">
          <p>
            Når du afslutter perioden låses alle ansøgninger som hørende til
            denne søgning. Statistik og tragten arkiveres til{" "}
            <strong className="font-medium text-ink">{period.name ?? "perioden"}</strong>.
          </p>
          <p>
            Job flyttes til <strong className="font-medium text-ink">Arkiv</strong> i
            menuen, hvor du altid kan se tidligere ansøgninger og perioder.
          </p>
          <p>
            Hvis du senere skal søge igen, kan du starte en ny periode fra
            indstillinger.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink disabled:opacity-50"
          >
            Ikke endnu
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            <Check className="size-3.5" strokeWidth={2.5} />
            {saving ? "Afslutter…" : "Afslut periode"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- stat row (6 cards) ------------------------------------------------------

function StatRow({ apps, events }: { apps: App[]; events: Event[] }) {
  const stats = useMemo(() => {
    const totalSent = apps.filter((a) => a.sentAt).length;
    const finalIds = new Set<number>();
    const replyIds = new Set<number>();
    const interviewIds = new Set<number>();
    const offerIds = new Set<number>();
    for (const e of events) {
      if (
        e.status === "interview" ||
        e.status === "offer" ||
        e.status === "rejected" ||
        e.status === "withdrawn"
      ) {
        finalIds.add(e.applicationId);
      }
      if (REPLY_STATUSES.has(e.status)) replyIds.add(e.applicationId);
      if (INTERVIEW_STATUSES.has(e.status)) interviewIds.add(e.applicationId);
      if (OFFER_STATUSES.has(e.status)) offerIds.add(e.applicationId);
    }
    const replyPct = totalSent > 0 ? Math.round((replyIds.size / totalSent) * 100) : 0;
    return {
      sent: totalSent,
      waiting: totalSent - finalIds.size,
      replied: replyIds.size,
      interview: interviewIds.size,
      offer: offerIds.size,
      replyPct,
    };
  }, [apps, events]);

  const items = [
    { label: "Sendt", value: String(stats.sent) },
    { label: "Afventer", value: String(stats.waiting) },
    { label: "Svar", value: String(stats.replied), small: `/${stats.sent}` },
    { label: "Til samtale", value: String(stats.interview) },
    { label: "Tilbud", value: String(stats.offer) },
    { label: "Svarprocent", value: String(stats.replyPct), small: "%" },
  ];

  return (
    <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-6 md:gap-2.5 md:overflow-visible md:px-0">
      {items.map((s) => (
        <div
          key={s.label}
          className="min-w-[92px] shrink-0 rounded-[10px] bg-bg-elevated px-3.5 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] md:min-w-0"
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            {s.label}
          </div>
          <div className="mt-1 font-serif text-[22px] leading-[1.1] text-ink">
            {s.value}
            {s.small && (
              <small className="text-[12px] text-light">{s.small}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- statistics (chart + funnel combined) -----------------------------------

type ChartFilter = "sent" | "replied" | "interview" | "offer" | "rejected";

const CHART_FILTER_LABELS: Record<ChartFilter, string> = {
  sent: "Sendt",
  replied: "Svar",
  interview: "Til samtale",
  offer: "Tilbud",
  rejected: "Afvist",
};

const CHART_FILTER_COLORS: Record<ChartFilter, string> = {
  sent: "var(--accent)",
  replied: "var(--warning)",
  interview: "var(--success)",
  offer: "var(--success)",
  rejected: "var(--danger)",
};

function JobStats({ apps, events }: { apps: App[]; events: Event[] }) {
  const [period, setPeriod] = useState<Period>("90d");

  const range = useMemo(() => {
    const today = new Date();
    const todayIso = fmtIso(today);
    if (period === "30d") return { start: fmtIso(addDays(today, -29)), end: todayIso };
    if (period === "90d") return { start: fmtIso(addDays(today, -89)), end: todayIso };
    if (period === "6m") {
      const d = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return { start: fmtIso(d), end: todayIso };
    }
    const sent = apps.map((a) => a.sentAt).filter(Boolean).sort();
    return { start: sent[0] ?? todayIso, end: todayIso };
  }, [period, apps]);

  const [chartFilter, setChartFilter] = useState<ChartFilter>("sent");

  const cohort = useMemo(
    () => apps.filter((a) => a.sentAt && a.sentAt >= range.start && a.sentAt <= range.end),
    [apps, range],
  );

  // Datoer for det aktuelle filter — enten sentAt (for "sent") eller events
  // med matching status (for de andre).
  const filteredDates = useMemo(() => {
    if (chartFilter === "sent") {
      return cohort
        .map((a) => a.sentAt)
        .filter((d): d is string => Boolean(d));
    }
    const cohortIds = new Set(cohort.map((a) => a.id));
    const matchingStatuses: Set<Status> =
      chartFilter === "replied"
        ? REPLY_STATUSES
        : new Set([chartFilter as Status]);
    return events
      .filter((e) => cohortIds.has(e.applicationId) && matchingStatuses.has(e.status))
      .map((e) => e.occurredAt);
  }, [chartFilter, cohort, events]);

  const buckets = useMemo(() => {
    const start = parseIso(range.start);
    const end = parseIso(range.end);
    const span = Math.max(0, daysBetween(start, end)) + 1;
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
      const firstMondayOffset = (start.getDay() + 6) % 7;
      let cursor = addDays(start, -firstMondayOffset);
      while (cursor <= end) {
        const bEnd = addDays(cursor, 6);
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

    for (const d of filteredDates) {
      const b = result.find((x) => d >= x.start && d <= x.end);
      if (b) b.count++;
    }
    return { items: result, granularity };
  }, [filteredDates, range]);

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
    const finalIds = new Set<number>();
    for (const e of events) {
      if (!cohortIds.has(e.applicationId)) continue;
      if (
        e.status === "interview" ||
        e.status === "offer" ||
        e.status === "rejected" ||
        e.status === "withdrawn"
      ) {
        finalIds.add(e.applicationId);
      }
    }
    return {
      sent: cohort.length,
      waiting: cohort.length - finalIds.size,
      replied: reached(REPLY_STATUSES),
      interview: reached(INTERVIEW_STATUSES),
      offer: reached(OFFER_STATUSES),
      rejected: reached(REJECTED_STATUSES),
    };
  }, [cohort, events]);

  const maxBar = Math.max(1, ...buckets.items.map((b) => b.count));
  const labelEvery = Math.ceil(buckets.items.length / 16);

  return (
    <div className="mb-6 rounded-[10px] bg-bg-elevated p-5 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3 border-b border-hair pb-2.5">
        <h2 className="font-serif text-[19px] font-medium text-accent">Jobstatistik</h2>
        <div className="inline-flex shrink-0 gap-0.5 rounded-[8px] bg-bg p-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[6px] px-2.5 py-1 text-[11px] transition-colors ${
                period === p
                  ? "bg-accent text-white"
                  : "text-mid hover:text-ink"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-[1.5fr_1fr] md:items-start">
        {/* Aktivitet (chart) */}
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-mid">
              Aktivitet · {CHART_FILTER_LABELS[chartFilter]}
            </span>
            <span className="text-[11px] text-light">
              {filteredDates.length}{" "}
              {chartFilter === "sent"
                ? `ansøgning${filteredDates.length === 1 ? "" : "er"}`
                : `event${filteredDates.length === 1 ? "" : "s"}`}
              {" · "}
              {buckets.granularity === "week" ? "uger" : "måneder"}
            </span>
          </div>
          <div className="flex h-[140px] items-stretch gap-[2px]">
            {buckets.items.map((b, i) => (
              <div
                key={i}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >
                <div
                  className="w-full rounded-t-[3px] transition-all hover:opacity-80"
                  style={{
                    height: `${(b.count / maxBar) * 100}%`,
                    minHeight: b.count > 0 ? 2 : 0,
                    background: CHART_FILTER_COLORS[chartFilter],
                  }}
                  title={`${b.count} ${
                    buckets.granularity === "month"
                      ? `· måned: ${b.label}`
                      : `· uge ${b.label} (${shortDate(b.start)}–${shortDate(b.end)})`
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[2px]">
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
        </div>

        {/* Tragten (funnel) — klikbar for at filtrere chart */}
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-mid">
              Tragten
            </span>
            <span className="text-[10px] italic text-light">klik for at filtrere</span>
          </div>
          <div className="flex flex-col gap-1">
            {(
              [
                { label: "Sendt", value: funnel.sent, color: "var(--accent)", key: "sent" as ChartFilter },
                { label: "Afventer", value: funnel.waiting, color: "var(--warning)", key: null },
                { label: "Til samtale", value: funnel.interview, color: "var(--success)", key: "interview" as ChartFilter },
                { label: "Tilbud", value: funnel.offer, color: "var(--success)", key: "offer" as ChartFilter },
                { label: "Afvist", value: funnel.rejected, color: "var(--danger)", key: "rejected" as ChartFilter },
              ] as const
            ).map((stage) => {
              const pct = funnel.sent > 0 ? (stage.value / funnel.sent) * 100 : 0;
              const isActive = stage.key !== null && chartFilter === stage.key;
              const isClickable = stage.key !== null;
              return (
                <button
                  key={stage.label}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => stage.key && setChartFilter(stage.key)}
                  className={`flex items-center gap-2.5 rounded-[6px] px-2 py-1 text-left transition-colors ${
                    isClickable ? "cursor-pointer" : "cursor-default"
                  } ${
                    isActive
                      ? "bg-bg"
                      : isClickable
                        ? "hover:bg-bg/60"
                        : ""
                  }`}
                >
                  <span
                    className={`w-[80px] shrink-0 text-[11px] ${
                      isActive ? "font-semibold text-ink" : "text-mid"
                    }`}
                  >
                    {stage.label}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-[5px] bg-bg">
                    {stage.value > 0 && (
                      <div
                        className="flex h-full items-center rounded-[5px] px-1.5 text-[10px] font-semibold text-white"
                        style={{
                          width: `${Math.max(pct, 8)}%`,
                          background: stage.color,
                        }}
                      >
                        {stage.value}
                      </div>
                    )}
                  </div>
                  <span className="w-[34px] shrink-0 text-right text-[10px] text-light">
                    {Math.round(pct)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors ${
        active
          ? statusColor
            ? STATUS_CLASSES[statusColor]
            : "bg-accent text-white"
          : "bg-bg-elevated text-mid hover:bg-bg-subtle hover:text-ink"
      }`}
    >
      {label}
      <span className={`text-[11px] ${active ? "opacity-75" : "text-dim"}`}>
        {count}
      </span>
    </button>
  );
}

const STATUS_PILL_CLASSES: Record<Status, string> = {
  sent: "bg-accent-bg text-accent",
  no_response: "bg-[rgba(160,174,192,0.15)] text-mid",
  replied: "bg-[var(--warning-soft)] text-warning",
  interview: "bg-[var(--success-soft)] text-success",
  offer: "bg-[rgba(74,222,128,0.22)] text-success",
  rejected: "bg-[rgba(248,113,113,0.12)] text-danger",
  withdrawn: "bg-[rgba(160,174,192,0.15)] text-mid",
};

const STATUS_DOT_BG: Record<Status, string> = {
  sent: "bg-accent",
  no_response: "bg-mid",
  replied: "bg-warning",
  interview: "bg-success",
  offer: "bg-success",
  rejected: "bg-danger",
  withdrawn: "bg-mid",
};

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] ${STATUS_PILL_CLASSES[status]}`}
    >
      <span className={`size-1.5 rounded-full ${STATUS_DOT_BG[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function CompactTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) return null;
  // Vis max sidste 3 events for at undgå at trampe pladsen
  const visible = events.slice(-3);
  return (
    <div className="flex min-w-0 items-center gap-1 text-[10px]">
      {visible.map((e, i) => (
        <span key={e.id} className="inline-flex shrink-0 items-center gap-1">
          {i > 0 && <span className="text-dim">›</span>}
          <span
            className={`size-1.5 rounded-full ${STATUS_DOT_BG[e.status]}`}
          />
          <span className="uppercase tracking-[0.3px] text-mid">
            {STATUS_LABELS[e.status]}
          </span>
          <span className="text-dim">{shortDate(e.occurredAt)}</span>
        </span>
      ))}
    </div>
  );
}

function daysSinceISO(iso: string): number {
  return Math.floor(
    (Date.now() - parseIso(iso).getTime()) / 86_400_000,
  );
}

function RowCard({
  app,
  timeline,
}: {
  app: App;
  timeline: Event[];
}) {
  const days = app.sentAt ? daysSinceISO(app.sentAt) : null;
  const sentShort = app.sentAt
    ? danishLongDate(app.sentAt).split(" ").slice(0, 2).join(" ")
    : null;
  const meta =
    app.contactPerson || app.documents.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-light">
        {app.contactPerson && (
          <span className="inline-flex items-center gap-1">
            <span className="opacity-70">●</span>
            {app.contactPerson}
          </span>
        )}
        {app.documents.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3 shrink-0" />
            {app.documents.length}{" "}
            {app.documents.length === 1 ? "dokument" : "dokumenter"}
          </span>
        )}
      </div>
    ) : null;
  const sentDate = sentShort && (
    <span className="text-[11px] uppercase tracking-[0.3px] text-light">
      <strong className="font-medium text-mid">{sentShort}</strong>
      {days !== null && <span className="ml-1">· {days} dage</span>}
    </span>
  );

  return (
    <Link
      href={`/jobs/${app.id}`}
      className="block rounded-[10px] bg-bg-elevated p-3 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] transition-colors hover:bg-bg-subtle md:px-4 md:py-3"
    >
      {/* Mobile layout: 3 rækker — top (firma + status), meta (docs + dato), timeline */}
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-[14px] font-medium text-ink">
            {app.company}
            {app.role && <span className="text-mid"> · {app.role}</span>}
          </div>
          <StatusPill status={app.status} />
        </div>
        {(meta || sentDate) && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">{meta}</div>
            {sentDate}
          </div>
        )}
        {timeline.length > 0 && (
          <div className="mt-2 border-t border-hair pt-2">
            <CompactTimeline events={timeline} />
          </div>
        )}
      </div>

      {/* Desktop layout: én linje med 4 kolonner */}
      <div className="hidden md:grid md:grid-cols-[110px_1fr_240px_120px] md:items-center md:gap-4">
        <StatusPill status={app.status} />
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink">
            {app.company}
            {app.role && <span className="text-mid"> · {app.role}</span>}
          </div>
          {meta && <div className="mt-1">{meta}</div>}
        </div>
        <div className="min-w-0">
          <CompactTimeline events={timeline} />
        </div>
        <div className="text-right">{sentDate}</div>
      </div>
    </Link>
  );
}

function EditCard({
  app,
  unattached,
  onDocumentsChange,
  onSave,
  onCancel,
}: {
  app: App;
  unattached: AppDoc[];
  onDocumentsChange: (next: AppDoc[]) => void;
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
        <Field label="Dokumenter" full>
          <ApplicationDocuments
            applicationId={app.id}
            attached={app.documents}
            availableForAttach={unattached}
            onChange={onDocumentsChange}
          />
          {draft.files && (
            <div className="mt-2 rounded-[3px] border border-border-light bg-bg px-2 py-1">
              <p className="mb-1 text-[10px] uppercase tracking-[0.4px] text-dim">
                Legacy filnavne (kun visning)
              </p>
              <FileLinks value={draft.files} />
            </div>
          )}
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
  const [url, setUrl] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [notes, setNotes] = useState("");
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
        files: null,
        applicationText: null,
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
          applicationText: "",
          sentAt: res.application.sentAt ?? "",
          updatedAt: res.application.updatedAt,
          documents: [],
        });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !pending && onCancel()}
    >
      <div
        className="w-full max-w-[520px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-serif text-[20px] text-ink">Ny ansøgning</h3>
        <p className="mb-4 text-[13px] text-mid">
          Tilknyt CV / ansøgning / job-opslag senere på ansøgningens side.
        </p>
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
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink disabled:opacity-50"
          >
            Annullér
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            {pending ? "Tilføjer…" : "Tilføj"}
          </button>
        </div>
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

// --- Week goal banner --------------------------------------------------------

function WeekGoalBanner({
  apps,
  weekStart,
  weekTarget,
}: {
  apps: App[];
  weekStart: string;
  weekTarget: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(weekTarget?.toString() ?? "");
  const [saving, startSave] = useTransition();

  const weekEnd = fmtIso(addDays(parseIso(weekStart), 6));
  const sentThisWeek = apps.filter(
    (a) => a.sentAt && a.sentAt >= weekStart && a.sentAt <= weekEnd,
  ).length;

  function openModal() {
    setInput(weekTarget?.toString() ?? "");
    setOpen(true);
  }

  function save() {
    const trimmed = input.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1000)) {
      return;
    }
    startSave(async () => {
      await setWeekGoal({
        weekStart,
        text: "",
        applicationsTarget: value,
        focusHoursTargetX10: null,
      });
      setOpen(false);
      router.refresh();
    });
  }

  const banner =
    weekTarget === null ? (
      <button
        type="button"
        onClick={openModal}
        className="mb-5 flex w-full items-center gap-3 rounded-[10px] border border-dashed border-hair-strong px-4 py-3 text-left text-[12px] italic text-light hover:border-accent hover:text-accent"
      >
        <span>Sæt et ugentligt mål for ansøgninger sendt</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={openModal}
        title="Klik for at ændre mål"
        className="mb-5 flex w-full cursor-pointer flex-wrap items-center gap-3 rounded-[10px] border border-[var(--accent-soft-strong)] bg-gradient-to-r from-[var(--accent-bg)] to-transparent px-4 py-2.5 text-left transition-colors hover:bg-[var(--accent-bg)]"
      >
        <span className="text-[12px] text-mid">Ugens mål — ansøgninger sendt:</span>
        <span className="font-serif text-[16px] text-ink">
          {sentThisWeek}
          <span className="text-[13px] text-light">/{weekTarget}</span>
        </span>
        <div className="h-[5px] min-w-[140px] flex-1 overflow-hidden rounded-[4px] bg-bg">
          <div
            className="h-full rounded-[4px] bg-accent transition-all"
            style={{
              width: `${weekTarget > 0 ? Math.min(100, (sentThisWeek / weekTarget) * 100) : 0}%`,
            }}
          />
        </div>
        <span className="text-[11px] italic text-light">
          {sentThisWeek >= weekTarget
            ? "Målet er nået for denne uge"
            : `${weekTarget - sentThisWeek} tilbage til søndag`}
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
              Ugentligt mål
            </h3>
            <p className="mb-4 text-[13px] text-mid">
              Hvor mange ansøgninger vil du sende per uge?
            </p>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Mål per uge
            </div>
            <input
              type="number"
              min="0"
              max="1000"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="fx 5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setOpen(false);
              }}
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[16px]"
            />
            <p className="mt-2 text-[11px] italic text-light">
              Sæt til tomt for at fjerne målet for denne uge.
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
