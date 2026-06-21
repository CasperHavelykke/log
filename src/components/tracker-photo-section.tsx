"use client";

import { useState, useTransition } from "react";
import { Camera, Check, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/image-compress";
import {
  createTracker,
  uploadTrackerPhoto,
} from "@/app/(app)/health/trackere/actions";

export type TrackerRef = {
  id: number;
  name: string;
  kind: string;
};

type Preset = {
  key: string;
  label: string;
  name: string;
  kind: "skin_spot" | "dermatitis" | "other";
};

const PRESETS: Preset[] = [
  { key: "skin_spot", label: "Skønhedsplet", name: "Skønhedsplet", kind: "skin_spot" },
  { key: "dermatitis", label: "Skæleksem", name: "Skæleksem", kind: "dermatitis" },
];

export function TrackerPhotoSection({
  date,
  trackers: initialTrackers,
}: {
  date: string;
  trackers: TrackerRef[];
}) {
  const [trackers, setTrackers] = useState<TrackerRef[]>(initialTrackers);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [creating, setCreating] = useState<string | null>(null); // preset key while creating

  const selected = trackers.find((t) => t.id === selectedId) ?? null;

  // Filter out presets the user already has (match by name).
  const usedNames = new Set(
    trackers.map((t) => t.name.trim().toLowerCase()),
  );

  async function createFromPreset(p: Preset) {
    setCreating(p.key);
    const res = await createTracker({
      name: p.name,
      kind: p.kind,
      notes: null,
    });
    setCreating(null);
    if (res.ok) {
      const t = {
        id: res.tracker.id,
        name: res.tracker.name,
        kind: res.tracker.kind,
      };
      setTrackers((prev) => [...prev, t]);
      setSelectedId(t.id);
    }
  }

  async function createCustom() {
    const name = customName.trim();
    if (!name) return;
    setCreating("custom");
    const res = await createTracker({
      name,
      kind: "other",
      notes: null,
    });
    setCreating(null);
    if (res.ok) {
      const t = {
        id: res.tracker.id,
        name: res.tracker.name,
        kind: res.tracker.kind,
      };
      setTrackers((prev) => [...prev, t]);
      setSelectedId(t.id);
      setCustomName("");
      setShowCustom(false);
    }
  }

  if (selected) {
    return (
      <PhotoUploader
        tracker={selected}
        date={date}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] italic leading-snug text-light">
        Følg et område med billeder over tid — fx en plet eller eksem du
        vil holde øje med. Tilføj et nyt billede når du tjekker det.
      </p>

      {trackers.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.5px] text-light">
            Fortsæt opfølgning
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trackers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-accent-dim bg-accent-bg px-3 py-1 text-[12px] font-medium text-accent-bright transition hover:border-accent"
              >
                <Camera className="size-3" />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.5px] text-light">
          {trackers.length > 0 ? "Start ny opfølgning" : "Start en opfølgning"}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const already = usedNames.has(p.name.toLowerCase());
            const loading = creating === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => createFromPreset(p)}
                disabled={already || creating !== null}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  already
                    ? "cursor-not-allowed border-border-light bg-bg text-dim"
                    : "border-border-light bg-bg text-mid hover:border-accent hover:text-accent-bright"
                } ${creating ? "cursor-not-allowed opacity-60" : ""}`}
                title={
                  already
                    ? "Du har allerede en opfølgning med dette navn"
                    : `Opret en opfølgning af ${p.label.toLowerCase()}`
                }
              >
                {loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Plus className="size-3" />
                )}
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            disabled={creating !== null}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border-light bg-bg px-2.5 py-1 text-[11px] text-mid transition hover:border-accent hover:text-accent-bright"
          >
            <Plus className="size-3" />
            Andet område
          </button>
        </div>
        {showCustom && (
          <div className="mt-2 flex items-center gap-1">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Fx 'Plet på arm'"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") createCustom();
                if (e.key === "Escape") {
                  setShowCustom(false);
                  setCustomName("");
                }
              }}
              className="!text-[12px] !py-1"
              style={{ maxWidth: "200px" }}
            />
            <button
              type="button"
              onClick={createCustom}
              disabled={!customName.trim() || creating !== null}
              className="cursor-pointer rounded-[3px] border border-accent bg-accent px-2.5 py-1 text-[11px] text-white hover:bg-accent-bright disabled:opacity-50"
            >
              Opret
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustom(false);
                setCustomName("");
              }}
              className="cursor-pointer p-1 text-dim hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
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
