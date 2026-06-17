"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, X } from "lucide-react";
import { formatDanishDate } from "@/lib/date";
import { deletePhoto, setPhotoTracker, updatePhotoCaption } from "./actions";

type PhotoRow = {
  id: number;
  trackerId: number | null;
  caption: string | null;
  takenAt: string;
  mimeType: string;
  sizeBytes: number;
};

type TrackerRow = {
  id: number;
  name: string;
  kind: string;
};

export function PhotosListClient({
  initialPhotos,
  trackers,
}: {
  initialPhotos: PhotoRow[];
  trackers: TrackerRow[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [filter, setFilter] = useState<"all" | "orphans">("all");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const visible = photos.filter((p) =>
    filter === "orphans" ? p.trackerId === null : true,
  );

  const orphanCount = photos.filter((p) => p.trackerId === null).length;
  const trackerById = new Map(trackers.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="font-serif text-[36px] font-medium leading-none text-ink">
            Fotos
          </h1>
          <p className="mt-1 font-serif text-sm italic text-mid">
            {photos.length} fotos · {orphanCount} uden tracker
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-[3px] border px-3 py-1.5 text-[12px] transition ${
              filter === "all"
                ? "border-accent bg-accent text-white"
                : "border-border text-mid hover:border-accent-bright hover:text-ink"
            }`}
          >
            Alle
          </button>
          <button
            type="button"
            onClick={() => setFilter("orphans")}
            className={`rounded-[3px] border px-3 py-1.5 text-[12px] transition ${
              filter === "orphans"
                ? "border-accent bg-accent text-white"
                : "border-border text-mid hover:border-accent-bright hover:text-ink"
            }`}
          >
            Uden tracker ({orphanCount})
          </button>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="text-center text-[14px] italic text-light">
          Ingen fotos.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              tracker={p.trackerId ? trackerById.get(p.trackerId) : undefined}
              trackers={trackers}
              onTrackerChanged={(trackerId) =>
                setPhotos((prev) =>
                  prev.map((x) => (x.id === p.id ? { ...x, trackerId } : x)),
                )
              }
              onCaptionChanged={(caption) =>
                setPhotos((prev) =>
                  prev.map((x) => (x.id === p.id ? { ...x, caption } : x)),
                )
              }
              onDeleted={() =>
                setPhotos((prev) => prev.filter((x) => x.id !== p.id))
              }
              onOpen={() => setLightbox(p.id)}
            />
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-[12px] text-light">
        <Link href="/health/trackere" className="underline">
          Gå til trackere →
        </Link>
      </p>

      {lightbox !== null && (
        <Lightbox photoId={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  tracker,
  trackers,
  onTrackerChanged,
  onCaptionChanged,
  onDeleted,
  onOpen,
}: {
  photo: PhotoRow;
  tracker: TrackerRow | undefined;
  trackers: TrackerRow[];
  onTrackerChanged: (trackerId: number | null) => void;
  onCaptionChanged: (caption: string | null) => void;
  onDeleted: () => void;
  onOpen: () => void;
}) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionInput, setCaptionInput] = useState(photo.caption ?? "");
  const [pending, start] = useTransition();

  function changeTracker(value: string) {
    const trackerId = value === "" ? null : Number(value);
    start(async () => {
      await setPhotoTracker(photo.id, trackerId);
      onTrackerChanged(trackerId);
    });
  }

  function saveCaption() {
    start(async () => {
      await updatePhotoCaption(photo.id, captionInput);
      onCaptionChanged(captionInput.trim() || null);
      setEditingCaption(false);
    });
  }

  function remove() {
    if (!confirm("Slet dette foto permanent? Filen slettes også fra storage.")) {
      return;
    }
    start(async () => {
      const res = await deletePhoto(photo.id);
      if (res.ok) onDeleted();
    });
  }

  return (
    <div className="overflow-hidden rounded-[4px] border border-border-light bg-card">
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full cursor-pointer overflow-hidden bg-bg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/photo/${photo.id}`}
          alt={photo.caption ?? ""}
          className="size-full object-cover transition hover:scale-105"
          loading="lazy"
        />
      </button>
      <div className="space-y-2 p-2.5 text-[12px]">
        {editingCaption ? (
          <div className="flex gap-1">
            <input
              type="text"
              value={captionInput}
              onChange={(e) => setCaptionInput(e.target.value)}
              className="!text-[12px]"
              autoFocus
              onBlur={saveCaption}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCaption();
                if (e.key === "Escape") {
                  setCaptionInput(photo.caption ?? "");
                  setEditingCaption(false);
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingCaption(true)}
            className="block w-full cursor-text truncate text-left text-ink hover:text-accent-bright"
            title={photo.caption ?? "(tilføj billedtekst)"}
          >
            {photo.caption ?? (
              <span className="italic text-dim">+ billedtekst</span>
            )}
          </button>
        )}
        <div className="text-[11px] text-light">
          {formatDanishDate(photo.takenAt.slice(0, 10))}
        </div>
        <select
          value={photo.trackerId ?? ""}
          onChange={(e) => changeTracker(e.target.value)}
          disabled={pending}
          className="!text-[11px]"
        >
          <option value="">— ingen tracker —</option>
          {trackers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.kind})
            </option>
          ))}
        </select>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] text-dim hover:bg-bg hover:text-danger"
          >
            <Trash2 className="size-3" />
            Slet
          </button>
        </div>
      </div>
    </div>
  );
}

function Lightbox({
  photoId,
  onClose,
}: {
  photoId: number;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 cursor-pointer rounded p-2 text-white/80 hover:bg-white/10"
      >
        <X className="size-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/photo/${photoId}`}
        alt=""
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
