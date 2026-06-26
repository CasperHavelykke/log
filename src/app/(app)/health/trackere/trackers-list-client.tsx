"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Activity, Archive, Plus, X } from "lucide-react";
import { createTracker, updateTracker } from "./actions";

type TrackerRow = {
  id: number;
  name: string;
  kind: string;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  photoCount: number;
  latestTaken: string | null;
};

const KIND_LABELS: Record<string, string> = {
  skin_spot: "Hud-plet",
  dermatitis: "Skæleksem",
  staph: "Stafylokokker",
  weight: "Vægt",
  waist: "Livvidde",
  other: "Andet",
};

const KIND_COLORS: Record<string, string> = {
  skin_spot: "bg-[rgba(236,72,153,0.15)] text-[#ec4899]",
  dermatitis: "bg-[var(--warning-soft)] text-[var(--warning)]",
  staph: "bg-[rgba(236,72,153,0.15)] text-[#ec4899]",
  weight: "bg-[var(--accent-bg)] text-accent",
  waist: "bg-[rgba(251,146,60,0.15)] text-[#fb923c]",
  other: "bg-bg-subtle text-mid",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${d}. ${months[m - 1]} ${y}`;
}

export function TrackersListClient({
  initialTrackers,
}: {
  initialTrackers: TrackerRow[];
}) {
  const [trackers, setTrackers] = useState(initialTrackers);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const visible = showArchived
    ? trackers
    : trackers.filter((t) => !t.archived);

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link
          href="/health"
          className="inline-flex items-center gap-1 text-[12px] text-light hover:text-accent"
        >
          ← Helbred
        </Link>
        <Link
          href="/health/photos"
          className="text-[12px] text-accent hover:underline"
        >
          Alle fotos →
        </Link>
      </div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-hair pb-5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Trackere
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            {trackers.length === 0
              ? "Ingen trackere endnu"
              : `${trackers.filter((t) => !t.archived).length} aktive`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Ny tracker
        </button>
      </header>

      <p className="mb-4 text-[13px] text-mid">
        En tracker er noget du følger over tid med billeder — fx en skønhedsplet,
        skæleksem på en bestemt placering, vægt-progression eller livvidde.
        Trackere koblet til daglige målinger viser også numerisk graf.
      </p>

      {trackers.some((t) => t.archived) && (
        <label className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-light">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-3.5"
          />
          Vis arkiverede
        </label>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
          Ingen trackere endnu — opret din første.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((t) => (
            <TrackerCard
              key={t.id}
              tracker={t}
              onArchive={(archived) =>
                setTrackers((prev) =>
                  prev.map((x) => (x.id === t.id ? { ...x, archived } : x)),
                )
              }
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          onCreated={(t) => {
            setTrackers((prev) => [
              ...prev,
              {
                ...t,
                notes: t.notes ?? null,
                archived: false,
                createdAt: new Date().toISOString(),
                photoCount: 0,
                latestTaken: null,
              },
            ]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function TrackerCard({
  tracker,
  onArchive,
}: {
  tracker: TrackerRow;
  onArchive: (archived: boolean) => void;
}) {
  const [pending, start] = useTransition();
  function toggleArchive() {
    start(async () => {
      const next = !tracker.archived;
      const res = await updateTracker({ id: tracker.id, archived: next });
      if (res.ok) onArchive(next);
    });
  }
  return (
    <div
      className={`rounded-[10px] bg-bg-elevated p-4 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] transition-opacity ${
        tracker.archived ? "opacity-60" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/health/trackere/${tracker.id}?from=health`}
          className="font-serif text-[18px] leading-tight text-ink hover:text-accent"
        >
          {tracker.name}
        </Link>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.3px] ${
            KIND_COLORS[tracker.kind] ?? KIND_COLORS.other
          }`}
        >
          {KIND_LABELS[tracker.kind] ?? tracker.kind}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-light">
        <span className="inline-flex items-center gap-1">
          <Activity className="size-3" />
          {tracker.photoCount} {tracker.photoCount === 1 ? "billede" : "billeder"}
        </span>
        {tracker.latestTaken && (
          <span>Seneste: {fmtDate(tracker.latestTaken)}</span>
        )}
      </div>
      {tracker.notes && (
        <p className="mt-2 line-clamp-2 text-[12px] text-mid">{tracker.notes}</p>
      )}
      <button
        type="button"
        onClick={toggleArchive}
        disabled={pending}
        className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[11px] text-dim hover:text-mid"
      >
        <Archive className="size-3" />
        {tracker.archived ? "Genaktiver" : "Arkiver"}
      </button>
    </div>
  );
}

function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: { id: number; name: string; kind: string; notes: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("skin_spot");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim()) {
      setError("Navn er påkrævet");
      return;
    }
    setError(null);
    start(async () => {
      const res = await createTracker({
        name: name.trim(),
        kind: kind as never,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated({
        id: res.tracker.id,
        name: res.tracker.name,
        kind: res.tracker.kind,
        notes: res.tracker.notes ?? null,
      });
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="w-full max-w-[440px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Ny tracker
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              Følg noget over tid
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center rounded-[6px] p-1 text-dim hover:bg-bg hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Navn
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="fx 'Skønhedsplet højre underarm' eller 'Vægt'"
              autoFocus
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Type
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            >
              <option value="skin_spot">Hud-plet / skønhedsplet</option>
              <option value="dermatitis">Skæleksem (kobler til dagsmål)</option>
              <option value="staph">Stafylokokker (kobler til dagsmål)</option>
              <option value="weight">Vægt (kobler til dagsmål)</option>
              <option value="waist">Livvidde (kobler til dagsmål)</option>
              <option value="other">Andet</option>
            </select>
            <p className="mt-1 text-[11px] text-dim">
              Trackere koblet til dagsmål viser graf af de eksisterende værdier
              ved siden af billederne.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Note <span className="normal-case tracking-normal text-dim">— valgfri</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="fx 'Født med denne, vil bare holde øje'"
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            />
          </div>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink disabled:opacity-50"
            >
              Annullér
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !name.trim()}
              className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Opretter…" : "Opret"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
