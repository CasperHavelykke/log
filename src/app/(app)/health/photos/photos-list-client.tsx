"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { formatDanishDate } from "@/lib/date";
import { useHorizontalSwipe } from "@/lib/use-swipe";
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visible = photos.filter((p) =>
    filter === "orphans" ? p.trackerId === null : true,
  );

  const orphanCount = photos.filter((p) => p.trackerId === null).length;
  const trackerById = new Map(trackers.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <Link
        href="/health"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-light hover:text-accent"
      >
        ← Helbred
      </Link>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-hair pb-5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Fotos
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            {photos.length === 0
              ? "Ingen fotos endnu"
              : `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`}
          </h1>
          {orphanCount > 0 && (
            <p className="mt-1 text-[12px] italic text-light">
              {orphanCount} uden tracker
            </p>
          )}
        </div>
        <Link
          href="/health/trackere"
          className="text-[12px] text-accent hover:underline"
        >
          Trackere →
        </Link>
      </header>

      <div className="mb-5 inline-flex shrink-0 gap-0.5 rounded-[8px] bg-bg p-0.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[6px] px-3 py-1 text-[12px] transition-colors ${
            filter === "all" ? "bg-accent text-white" : "text-mid hover:text-ink"
          }`}
        >
          Alle
        </button>
        <button
          type="button"
          onClick={() => setFilter("orphans")}
          className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[6px] px-3 py-1 text-[12px] transition-colors ${
            filter === "orphans"
              ? "bg-accent text-white"
              : "text-mid hover:text-ink"
          }`}
        >
          Uden tracker ({orphanCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
          Ingen fotos i denne visning.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((p, i) => (
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
              onOpen={() => setLightboxIndex(i)}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && visible[lightboxIndex] && (
        <Lightbox
          photos={visible}
          index={lightboxIndex}
          onChangeIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          trackerById={trackerById}
        />
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
      const res = await updatePhotoCaption(photo.id, captionInput);
      if (!res.ok) {
        alert(res.error);
        return;
      }
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
    <div className="overflow-hidden rounded-[10px] bg-bg-elevated shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={onOpen}
        className="group block aspect-square w-full cursor-pointer overflow-hidden bg-bg-subtle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/photo/${photo.id}`}
          alt={photo.caption ?? ""}
          className="size-full object-cover transition-transform group-hover:scale-[1.03]"
          loading="lazy"
        />
      </button>
      <div className="space-y-2 p-3">
        {editingCaption ? (
          <input
            type="text"
            value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            maxLength={500}
            className="!rounded-[8px] !border-hair !bg-bg-subtle !py-1.5 !text-[12px]"
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
        ) : (
          <button
            type="button"
            onClick={() => setEditingCaption(true)}
            className="block w-full cursor-text truncate text-left text-[12px] font-medium text-ink hover:text-accent"
            title={photo.caption ?? "(tilføj billedtekst)"}
          >
            {photo.caption ?? (
              <span className="italic font-normal text-dim">+ billedtekst</span>
            )}
          </button>
        )}
        <div className="text-[11px] text-light">
          {formatDanishDate(photo.takenAt.slice(0, 10))}
          {tracker && <span className="ml-1 text-accent">· {tracker.name}</span>}
        </div>
        <select
          value={photo.trackerId ?? ""}
          onChange={(e) => changeTracker(e.target.value)}
          disabled={pending}
          className="!rounded-[8px] !border-hair !bg-bg-subtle !py-1 !text-[11px]"
        >
          <option value="">— ingen tracker —</option>
          {trackers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[6px] px-2 py-1 text-[11px] text-dim hover:bg-bg hover:text-danger"
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
  photos,
  index,
  onChangeIndex,
  onClose,
  trackerById,
}: {
  photos: PhotoRow[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
  trackerById: Map<number, TrackerRow>;
}) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;
  const tracker = photo.trackerId ? trackerById.get(photo.trackerId) : null;

  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= photos.length) return;
    onChangeIndex(next);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  const swipe = useHorizontalSwipe({
    onSwipeLeft: () => hasNext && go(1),
    onSwipeRight: () => hasPrev && go(-1),
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
      onTouchStart={swipe.onTouchStart}
      onTouchEnd={swipe.onTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 inline-flex cursor-pointer items-center rounded-full bg-black/60 p-2 text-white/85 backdrop-blur-sm hover:text-white top-[max(1rem,env(safe-area-inset-top))]"
        aria-label="Luk"
      >
        <X className="size-5" />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-2 top-1/2 hidden -translate-y-1/2 cursor-pointer rounded-full bg-black/60 p-3 text-white/85 backdrop-blur-sm hover:text-white sm:left-6 sm:inline-flex"
          aria-label="Forrige"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-2 top-1/2 hidden -translate-y-1/2 cursor-pointer rounded-full bg-black/60 p-3 text-white/85 backdrop-blur-sm hover:text-white sm:right-6 sm:inline-flex"
          aria-label="Næste"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/photo/${photo.id}`}
        alt={photo.caption ?? ""}
        className="max-h-[85vh] max-w-full select-none object-contain"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      <div className="absolute left-4 right-4 text-center text-[13px] text-white/80 bottom-[max(1rem,env(safe-area-inset-bottom))]">
        <div>
          {formatDanishDate(photo.takenAt.slice(0, 10))}
          {tracker && <span> · {tracker.name}</span>}
          {photo.caption && <span> · {photo.caption}</span>}
        </div>
        <div className="mt-1 text-[11px] text-white/50">
          {index + 1} / {photos.length}
        </div>
      </div>
    </div>
  );
}
