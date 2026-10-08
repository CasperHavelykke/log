"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, X } from "lucide-react";
import { formatDanishDate } from "@/lib/date";
import { setPhotoPrivate } from "@/app/(app)/health/trackere/actions";
import { PrivateOverlay } from "@/components/private-photo";

// Fælles lightbox for trackere og /health/photos.
//
// Swipe følger fingeren: forrige/næste billede ligger klar på hver side,
// og ved løft glider det på plads — eller tilbage, hvis trækket var for
// kort. Dokumentet bag lightboxen låses, og touch-action:none på
// overlayet stopper Safaris side-zoom og baggrunds-scroll (knib-zoom på
// selve billedet er bevidst ikke med endnu). Private billeder vises
// slørede, indtil man trykker på dem.

export type LightboxPhoto = {
  id: number;
  caption: string | null;
  takenAt: string; // ISO-dato (YYYY-MM-DD, evt. med tid bagefter)
  private: boolean;
};

const COMMIT_PX = 60; // mindste træk, der skifter billede
const FLICK_PX_PER_MS = 0.45; // et hurtigt svirp skifter også ved kortere træk
const FLICK_MIN_PX = 20;
const LOCK_PX = 8; // så langt skal fingeren, før retningen låses (vandret/lodret)

export function PhotoLightbox<T extends LightboxPhoto>({
  photos,
  index,
  onChangeIndex,
  onClose,
  revealed,
  onReveal,
  onPrivateChanged,
  onDelete,
  describe,
  dayGroups = false,
}: {
  photos: T[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
  revealed: Set<number>;
  onReveal: (id: number) => void;
  onPrivateChanged: (id: number, isPrivate: boolean) => void;
  // Sletning sker her, hvor man ser præcis hvilket billede det gælder.
  onDelete?: (id: number) => Promise<void>;
  // Ekstra tekst under datoen, fx trackerens navn på /health/photos.
  describe?: (photo: T) => string | null;
  // Trackere: "2 af 3 denne dag" + prikker, og datoen glider ind ved dagskifte.
  dayGroups?: boolean;
}) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const pendingDelta = useRef<-1 | 0 | 1>(0);
  const touch = useRef<{
    x: number;
    y: number;
    t: number;
    dir: "h" | "v" | null;
  } | null>(null);
  const moved = useRef(false);
  const [pending, start] = useTransition();

  // Lås dokumentet bag lightboxen. position:fixed-tricket er det eneste,
  // iOS Safari respekterer; scroll-positionen gendannes ved luk.
  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  function width() {
    return trackRef.current?.offsetWidth ?? window.innerWidth;
  }

  function animateTo(delta: -1 | 0 | 1) {
    pendingDelta.current = delta;
    setAnimating(true);
    setOffset(-delta * width());
  }

  function go(delta: -1 | 1) {
    if (animating) return;
    if (delta < 0 && !hasPrev) return;
    if (delta > 0 && !hasNext) return;
    animateTo(delta);
  }

  // Når glidningen er færdig, skiftes index og sporet nulstilles i samme
  // render — så det nye billede står på plads uden at blinke.
  function onTransitionEnd(e: React.TransitionEvent) {
    if (e.target !== e.currentTarget) return;
    const delta = pendingDelta.current;
    pendingDelta.current = 0;
    setAnimating(false);
    setOffset(0);
    if (delta !== 0) onChangeIndex(index + delta);
  }

  function cancelDrag() {
    touch.current = null;
    if (offset !== 0) animateTo(0);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length > 1) {
      cancelDrag();
      return;
    }
    if (animating) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), dir: null };
    moved.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = touch.current;
    if (!s) return;
    if (e.touches.length > 1) {
      cancelDrag();
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.dir === null) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      s.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (s.dir !== "h") return;
    moved.current = true;
    // Ved enderne følger billedet kun en tredjedel med — mærkbart "stop".
    const atEdge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
    setOffset(atEdge ? dx * 0.3 : dx);
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = touch.current;
    touch.current = null;
    if (!s || s.dir !== "h") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dt = Math.max(1, Date.now() - s.t);
    const flick = Math.abs(dx) > FLICK_MIN_PX && Math.abs(dx) / dt > FLICK_PX_PER_MS;
    const commit = Math.abs(dx) > COMMIT_PX || flick;
    if (commit && dx < 0 && hasNext) animateTo(1);
    else if (commit && dx > 0 && hasPrev) animateTo(-1);
    else if (offset !== 0) animateTo(0);
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
  }, [index, photos.length, animating]);

  // Et klik lige efter et træk er ikke et klik.
  function consumeMoved(): boolean {
    if (!moved.current) return false;
    moved.current = false;
    return true;
  }

  function onBackdropClick(e: React.MouseEvent) {
    if (consumeMoved()) return;
    if (e.target === e.currentTarget) onClose();
  }

  function onImageTap(p: T) {
    if (consumeMoved()) return;
    if (p.private && !revealed.has(p.id)) onReveal(p.id);
  }

  function togglePrivate(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !photo.private;
    start(async () => {
      const res = await setPhotoPrivate(photo.id, next);
      if (res.ok) onPrivateChanged(photo.id, next);
    });
  }

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDelete) return;
    if (!confirm("Slet dette billede? Filen slettes også.")) return;
    const id = photo.id;
    start(async () => {
      await onDelete(id);
    });
  }

  const day = photo.takenAt.slice(0, 10);
  const dayPhotos = photos.filter((p) => p.takenAt.slice(0, 10) === day);
  const posInDay = dayPhotos.findIndex((p) => p.id === photo.id) + 1;
  const extra = describe?.(photo) ?? null;

  return (
    <div
      className="fixed inset-0 z-[80] touch-none select-none bg-black/90"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={cancelDrag}
    >
      {/* Sporet med tre slides: forrige, nuværende, næste. Kun sporet
          flytter sig — knapper og tekst står stille. */}
      <div
        ref={trackRef}
        className="absolute inset-0"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating
            ? "transform 240ms cubic-bezier(0.2, 0.7, 0.3, 1)"
            : "none",
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {([-1, 0, 1] as const).map((d) => {
          const p = photos[index + d];
          if (!p) return null;
          const hidden = p.private && !revealed.has(p.id);
          return (
            <div
              key={p.id}
              className="absolute inset-0 flex items-center justify-center p-4"
              style={{ transform: `translateX(${d * 100}%)` }}
              onClick={onBackdropClick}
            >
              <div
                className="relative overflow-hidden"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageTap(p);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/photo/${p.id}`}
                  alt={p.caption ?? ""}
                  className={`max-h-[85vh] max-w-full object-contain ${
                    hidden ? "blur-3xl" : ""
                  }`}
                  draggable={false}
                />
                {hidden && <PrivateOverlay />}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 inline-flex cursor-pointer items-center rounded-full bg-black/60 p-2 text-white/85 backdrop-blur-sm hover:text-white top-[max(1rem,env(safe-area-inset-top))]"
        aria-label="Luk"
      >
        <X className="size-5" />
      </button>

      <div className="absolute left-4 flex items-center gap-1.5 top-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={togglePrivate}
          disabled={pending}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full bg-black/60 px-3 text-[12px] text-white/85 backdrop-blur-sm hover:text-white disabled:opacity-50"
        >
          {photo.private ? (
            <>
              <Eye className="size-4" />
              Fjern privat
            </>
          ) : (
            <>
              <EyeOff className="size-4" />
              Gør privat
            </>
          )}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            title="Slet billedet"
            aria-label="Slet billedet"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white/85 backdrop-blur-sm hover:text-danger disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

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

      <div className="pointer-events-none absolute left-4 right-4 text-center text-white/80 bottom-[max(1rem,env(safe-area-inset-bottom))]">
        {/* key=day: ved dagskifte genmonteres linjen og glider ind, så
            skiftet ikke kan overses, mens swipe inden for dagen er roligt. */}
        <div
          key={day}
          className={`font-serif text-[17px] text-white ${
            dayGroups ? "lightbox-date-in" : ""
          }`}
        >
          {formatDanishDate(day)}
        </div>
        {dayGroups && dayPhotos.length > 1 && (
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px]">
            {dayPhotos.map((p) => (
              <span
                key={p.id}
                className={`size-1.5 rounded-full ${
                  p.id === photo.id ? "bg-white" : "bg-white/35"
                }`}
              />
            ))}
            <span className="ml-1">
              {posInDay} af {dayPhotos.length} denne dag
            </span>
          </div>
        )}
        {(extra || photo.caption) && (
          <div className="mt-1 text-[13px]">
            {extra}
            {extra && photo.caption ? " · " : ""}
            {photo.caption}
          </div>
        )}
        <div className="mt-1 text-[11px] text-white/50">
          {index + 1} / {photos.length}
        </div>
      </div>
    </div>
  );
}
