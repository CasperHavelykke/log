"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { formatDanishDate } from "@/lib/date";
import { PRIVATE_BLUR_CLASS, PrivateOverlay } from "@/components/private-photo";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { setPhotoPrivate } from "@/app/(app)/health/trackere/actions";
import { deletePhoto, setPhotoTracker, updatePhotoCaption } from "./actions";

type PhotoRow = {
  id: number;
  trackerId: number | null;
  caption: string | null;
  takenAt: string;
  mimeType: string;
  sizeBytes: number;
  private: boolean;
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
  // Afslørede private billeder — kun for denne sidevisning, delt mellem
  // gitter og lightbox. Genindlæs siden, og alt er sløret igen.
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  function reveal(id: number) {
    setRevealed((prev) => new Set(prev).add(id));
  }
  function setPrivateLocal(id: number, isPrivate: boolean) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, private: isPrivate } : p)),
    );
  }

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
              hidden={p.private && !revealed.has(p.id)}
              onReveal={() => reveal(p.id)}
              onPrivateChanged={(v) => setPrivateLocal(p.id, v)}
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
        <PhotoLightbox
          photos={visible}
          index={lightboxIndex}
          revealed={revealed}
          onReveal={reveal}
          onPrivateChanged={setPrivateLocal}
          describe={(p) =>
            p.trackerId ? (trackerById.get(p.trackerId)?.name ?? null) : null
          }
          onDelete={async (id) => {
            const res = await deletePhoto(id);
            if (!res.ok) return;
            const remaining = visible.length - 1;
            setPhotos((prev) => prev.filter((x) => x.id !== id));
            setLightboxIndex((i) =>
              i === null || remaining === 0 ? null : Math.min(i, remaining - 1),
            );
          }}
          onChangeIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  tracker,
  trackers,
  hidden,
  onReveal,
  onPrivateChanged,
  onTrackerChanged,
  onCaptionChanged,
  onDeleted,
  onOpen,
}: {
  photo: PhotoRow;
  tracker: TrackerRow | undefined;
  trackers: TrackerRow[];
  // Privat og endnu ikke afsløret: første tryk viser, næste åbner lightbox.
  hidden: boolean;
  onReveal: () => void;
  onPrivateChanged: (isPrivate: boolean) => void;
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

  function togglePrivate() {
    const next = !photo.private;
    start(async () => {
      const res = await setPhotoPrivate(photo.id, next);
      if (res.ok) onPrivateChanged(next);
    });
  }

  return (
    <div className="overflow-hidden rounded-[10px] bg-bg-elevated shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={hidden ? onReveal : onOpen}
        title={hidden ? "Privat — tryk for at vise" : undefined}
        className="group relative block aspect-square w-full cursor-pointer overflow-hidden bg-bg-subtle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/photo/${photo.id}`}
          alt={photo.caption ?? ""}
          className={`size-full object-cover transition-transform group-hover:scale-[1.03] ${
            hidden ? PRIVATE_BLUR_CLASS : ""
          }`}
          loading="lazy"
        />
        {hidden && <PrivateOverlay compact />}
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
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={togglePrivate}
            disabled={pending}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[6px] px-2 py-1 text-[11px] text-dim hover:bg-bg hover:text-ink"
          >
            {photo.private ? (
              <>
                <Eye className="size-3" />
                Fjern privat
              </>
            ) : (
              <>
                <EyeOff className="size-3" />
                Gør privat
              </>
            )}
          </button>
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
