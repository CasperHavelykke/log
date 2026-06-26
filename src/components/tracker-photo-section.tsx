"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  Plus,
} from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/image-compress";
import {
  createTracker,
  uploadTrackerPhoto,
} from "@/app/(app)/health/trackere/actions";
import { danishLongDate } from "@/lib/date";

export type TrackerRef = {
  id: number;
  name: string;
  kind: string;
  photoCount: number;
  latestTakenAt: string | null;
};

const FOTO_PRESETS: { name: string; kind: "skin_spot" | "dermatitis" }[] = [
  { name: "Skønhedsplet", kind: "skin_spot" },
  { name: "Skæleksem", kind: "dermatitis" },
];

export function TrackerPhotoSection({
  trackers: initialTrackers,
}: {
  date: string;
  trackers: TrackerRef[];
}) {
  const [trackers, setTrackers] = useState<TrackerRef[]>(initialTrackers);
  const [adding, setAdding] = useState(false);
  const [customName, setCustomName] = useState("");
  const [creating, setCreating] = useState(false);

  const usedNames = new Set(trackers.map((t) => t.name.trim().toLowerCase()));

  async function createPreset(name: string, kind: "skin_spot" | "dermatitis") {
    if (creating) return;
    setCreating(true);
    const res = await createTracker({ name, kind, notes: null });
    setCreating(false);
    if (res.ok) {
      const t: TrackerRef = {
        id: res.tracker.id,
        name: res.tracker.name,
        kind: res.tracker.kind,
        photoCount: 0,
        latestTakenAt: null,
      };
      setTrackers((prev) => [...prev, t]);
      setAdding(false);
      setCustomName("");
    }
  }

  async function createCustom() {
    const name = customName.trim();
    if (!name || creating) return;
    setCreating(true);
    const res = await createTracker({ name, kind: "other", notes: null });
    setCreating(false);
    if (res.ok) {
      const t: TrackerRef = {
        id: res.tracker.id,
        name: res.tracker.name,
        kind: res.tracker.kind,
        photoCount: 0,
        latestTakenAt: null,
      };
      setTrackers((prev) => [...prev, t]);
      setAdding(false);
      setCustomName("");
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {trackers.map((t) => (
          <Link
            key={t.id}
            href={`/health/trackere/${t.id}?from=today`}
            className="flex cursor-pointer items-center gap-3 rounded-[10px] bg-bg-elevated p-3 text-left transition-colors hover:bg-bg-subtle md:bg-bg md:hover:bg-bg-subtle"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-bg)] text-accent">
              <Camera className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink">{t.name}</div>
              <div className="mt-0.5 text-[11px] text-light">
                {t.photoCount === 0
                  ? "Ingen billeder endnu"
                  : t.latestTakenAt
                    ? `${t.photoCount} ${t.photoCount === 1 ? "billede" : "billeder"} · seneste ${danishLongDate(t.latestTakenAt)}`
                    : `${t.photoCount} ${t.photoCount === 1 ? "billede" : "billeder"}`}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-dim" />
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-hair-strong p-3 text-[13px] text-light transition-colors hover:border-accent hover:text-accent sm:col-span-2 ${
            adding ? "border-accent text-accent" : ""
          }`}
        >
          <Plus className="size-4" />
          Tilføj opfølgning
        </button>
      </div>

      {adding && (
        <div className="mt-3 rounded-[8px] bg-bg-elevated p-3 md:bg-bg">
          <div className="mb-2 text-[10px] uppercase tracking-[0.5px] text-light">
            Vælg forslag eller skriv eget
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FOTO_PRESETS.map((p) => {
              const already = usedNames.has(p.name.toLowerCase());
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => createPreset(p.name, p.kind)}
                  disabled={already || creating}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                    already
                      ? "cursor-not-allowed border-hair bg-bg-elevated text-dim md:bg-bg-subtle"
                      : "cursor-pointer border-hair-strong bg-bg-elevated text-mid hover:border-accent hover:text-accent md:bg-bg-subtle"
                  }`}
                >
                  <Plus className="size-3" />
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Andet område (fx 'plet på arm')"
              onKeyDown={(e) => {
                if (e.key === "Enter") createCustom();
                if (e.key === "Escape") {
                  setAdding(false);
                  setCustomName("");
                }
              }}
              className="!rounded-[8px] !border-hair !bg-bg-elevated !py-1.5 !text-[16px] md:!rounded-[6px] md:!border-transparent md:!bg-bg-subtle md:!text-[13px]"
            />
            <button
              type="button"
              onClick={createCustom}
              disabled={!customName.trim() || creating}
              className="shrink-0 cursor-pointer rounded-[8px] border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50 md:rounded-[6px]"
            >
              Opret
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PhotoUploader({
  tracker,
  date,
  onBack,
}: {
  tracker: { id: number; name: string };
  date: string;
  onBack: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressed, setCompressed] = useState<{
    blob: Blob;
    bytes: number;
  } | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onPick(f: File | undefined) {
    setError(null);
    setSuccess(null);
    setCompressed(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("Vælg en billed-fil");
      return;
    }
    setFile(f);
    setCompressing(true);
    try {
      const result = await compressImage(f);
      setCompressed({ blob: result.blob, bytes: result.bytes });
    } catch (err) {
      setError(
        `Komprimering fejlede: ${err instanceof Error ? err.message : "ukendt"}`,
      );
    } finally {
      setCompressing(false);
    }
  }

  function submit() {
    if (!file || !compressed) return;
    setError(null);

    const compressedFile = new File(
      [compressed.blob],
      file.name.replace(/\.[^.]+$/, ".jpg"),
      { type: "image/jpeg" },
    );
    const fd = new FormData();
    fd.append("file", compressedFile);
    fd.append("trackerId", String(tracker.id));
    fd.append("caption", caption.trim());
    fd.append("takenAt", date);

    start(async () => {
      const res = await uploadTrackerPhoto(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(`Tilføjet til ${tracker.name}`);
      setFile(null);
      setCompressed(null);
      setCaption("");
      setTimeout(() => setSuccess(null), 3000);
    });
  }

  return (
    <div className="space-y-2 rounded-[3px] border border-border-light bg-bg p-3">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-mid">
          Tracker: <strong className="font-medium text-ink">{tracker.name}</strong>
        </span>
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer text-[11px] text-accent-bright hover:underline"
        >
          Skift
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border border-border bg-card px-2.5 py-1.5 text-[12px] text-ink hover:border-accent">
          <Camera className="size-3.5" />
          Tag billede
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPick(e.target.files?.[0])}
            className="hidden"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border border-border bg-card px-2.5 py-1.5 text-[12px] text-ink hover:border-accent">
          <ImagePlus className="size-3.5" />
          Bibliotek
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPick(e.target.files?.[0])}
            className="hidden"
          />
        </label>
      </div>

      {compressing && (
        <p className="inline-flex items-center gap-1 text-[11px] italic text-light">
          <Loader2 className="size-3 animate-spin" />
          Komprimerer…
        </p>
      )}
      {compressed && file && (
        <p className="inline-flex items-center gap-1 text-[11px] text-success">
          <Check className="size-3" />
          {formatFileSize(file.size)} → {formatFileSize(compressed.bytes)}
        </p>
      )}
      {compressed && (
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Billedtekst (valgfri)"
          className="!text-[12px] !py-1.5"
        />
      )}
      {compressed && (
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Uploader…
            </>
          ) : (
            "Upload"
          )}
        </button>
      )}

      {error && <p className="text-[12px] text-danger">{error}</p>}
      {success && (
        <p className="inline-flex items-center gap-1 text-[12px] text-success">
          <Check className="size-3.5" />
          {success}
        </p>
      )}
    </div>
  );
}
