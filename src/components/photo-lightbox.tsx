"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, X } from "lucide-react";
import { formatDanishDate } from "@/lib/date";
import { setPhotoPrivate } from "@/app/(app)/health/trackere/actions";
import { PrivateOverlay } from "@/components/private-photo";

// Fælles lightbox for trackere og /health/photos.
//
// Gestus-model:
//   én finger, u-zoomet  → swipe mellem billeder (følger fingeren; glider
//                           på plads eller tilbage ved løft)
//   to fingre            → knib-zoom omkring knibepunktet (1×–4×)
//   én finger, zoomet    → panorér (klemt til billedets kanter)
//   dobbelt-tryk/-klik   → 2,5× til/fra dér hvor man trykker
// Zoomen nulstilles ved billedskifte. Dokumentet bag lightboxen låses, og
// touch-action:none på overlayet stopper Safaris side-zoom og baggrunds-
// scroll. Private billeder vises slørede, indtil man trykker på dem.

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
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 25;

type Point = { x: number; y: number };
type Zoom = { id: number; s: number; x: number; y: number };
const NO_ZOOM = { s: 1, x: 0, y: 0 };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

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
  const currentHidden = photo.private && !revealed.has(photo.id);

  const trackRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
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

  // Zoom er bundet til billedets id: skift billede, og zoomen er væk —
  // uden en effect, der skal nulstille noget.
  const [zoomState, setZoomState] = useState<Zoom | null>(null);
  const zoom = zoomState && zoomState.id === photo.id ? zoomState : NO_ZOOM;
  const zoomed = zoom.s > 1;
  const [zoomAnimating, setZoomAnimating] = useState(false);
  const pinch = useRef<{ d0: number; s0: number; m0: Point; t0: Point } | null>(
    null,
  );
  const pan = useRef<{ x: number; y: number; t0: Point } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

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
  function height() {
    return trackRef.current?.offsetHeight ?? window.innerHeight;
  }
  // Punkter regnes relativt til skærmens midte — det er også billedets
  // transform-origin, så zoom-matematikken bliver ren.
  function rel(clientX: number, clientY: number): Point {
    return { x: clientX - width() / 2, y: clientY - height() / 2 };
  }

  // --- swipe -----------------------------------------------------------

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

  // --- zoom ------------------------------------------------------------

  // Panorering klemmes, så billedets kant aldrig slipper skærmkanten.
  // clientWidth/Height er layout-størrelsen (upåvirket af transform).
  function clampPan(s: number, x: number, y: number): Point {
    const img = imgRef.current;
    if (!img) return { x, y };
    const maxX = Math.max(0, (img.clientWidth * s - width()) / 2);
    const maxY = Math.max(0, (img.clientHeight * s - height()) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }

  function setZoom(s: number, x: number, y: number) {
    const p = clampPan(s, x, y);
    setZoomState({ id: photo.id, s, x: p.x, y: p.y });
  }

  function toggleZoomAt(p: Point) {
    setZoomAnimating(true);
    if (zoomed) {
      setZoom(1, 0, 0);
    } else {
      // Zoom omkring p fra (s=1, t=0): t = p·(1 − s).
      setZoom(DOUBLE_TAP_ZOOM, p.x * (1 - DOUBLE_TAP_ZOOM), p.y * (1 - DOUBLE_TAP_ZOOM));
    }
  }

  function dist(a: React.Touch, b: React.Touch) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function mid(a: React.Touch, b: React.Touch): Point {
    return rel((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
  }

  // --- touch -----------------------------------------------------------

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      // Knib: afbryd et evt. påbegyndt swipe og zoom i stedet.
      touch.current = null;
      pan.current = null;
      if (offset !== 0) {
        setAnimating(false);
        setOffset(0);
      }
      if (currentHidden) return;
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = {
        d0: dist(a, b),
        s0: zoom.s,
        m0: mid(a, b),
        t0: { x: zoom.x, y: zoom.y },
      };
      setZoomAnimating(false);
      moved.current = true;
      return;
    }
    if (e.touches.length > 2 || animating) return;
    const t = e.touches[0];
    moved.current = false;
    if (zoomed) {
      pan.current = { x: t.clientX, y: t.clientY, t0: { x: zoom.x, y: zoom.y } };
      setZoomAnimating(false);
      return;
    }
    touch.current = { x: t.clientX, y: t.clientY, t: e.timeStamp, dir: null };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (pinch.current && e.touches.length >= 2) {
      const pz = pinch.current;
      const [a, b] = [e.touches[0], e.touches[1]];
      const s = clamp((pz.s0 * dist(a, b)) / pz.d0, 1, MAX_ZOOM);
      // Hold billedpunktet under fingrene fast: q = (m0 − t0)/s0, t = m − q·s.
      const m = mid(a, b);
      const q = { x: (pz.m0.x - pz.t0.x) / pz.s0, y: (pz.m0.y - pz.t0.y) / pz.s0 };
      setZoom(s, m.x - q.x * s, m.y - q.y * s);
      return;
    }
    if (pan.current) {
      const t = e.touches[0];
      const dx = t.clientX - pan.current.x;
      const dy = t.clientY - pan.current.y;
      if (Math.abs(dx) > LOCK_PX || Math.abs(dy) > LOCK_PX) moved.current = true;
      setZoom(zoom.s, pan.current.t0.x + dx, pan.current.t0.y + dy);
      return;
    }
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
    if (pinch.current) {
      if (e.touches.length < 2) {
        pinch.current = null;
        // Næsten tilbage på 1× → snap helt på plads.
        if (zoom.s < 1.05) {
          setZoomAnimating(true);
          setZoom(1, 0, 0);
        }
      }
      return;
    }
    if (pan.current) {
      pan.current = null;
      return;
    }
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    if (s.dir === null) {
      // Et rent tryk: dobbelt-tryk zoomer; ellers lader vi click-eventet
      // klare afsløring/luk.
      const now = e.timeStamp;
      const lt = lastTap.current;
      if (
        lt &&
        now - lt.t < DOUBLE_TAP_MS &&
        Math.hypot(t.clientX - lt.x, t.clientY - lt.y) < DOUBLE_TAP_PX &&
        !currentHidden
      ) {
        lastTap.current = null;
        moved.current = true; // æd det efterfølgende click
        toggleZoomAt(rel(t.clientX, t.clientY));
      } else {
        lastTap.current = { t: now, x: t.clientX, y: t.clientY };
      }
      return;
    }
    if (s.dir !== "h") return;
    const dx = t.clientX - s.x;
    const dt = Math.max(1, e.timeStamp - s.t);
    const flick = Math.abs(dx) > FLICK_MIN_PX && Math.abs(dx) / dt > FLICK_PX_PER_MS;
    const commit = Math.abs(dx) > COMMIT_PX || flick;
    if (commit && dx < 0 && hasNext) animateTo(1);
    else if (commit && dx > 0 && hasPrev) animateTo(-1);
    else if (offset !== 0) animateTo(0);
  }

  function onTouchCancel() {
    pinch.current = null;
    pan.current = null;
    cancelDrag();
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

  // Et klik lige efter et træk/knib er ikke et klik.
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
      onTouchCancel={onTouchCancel}
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
          const isCurrent = d === 0;
          return (
            <div
              key={p.id}
              className="absolute inset-0 flex items-center justify-center p-4"
              style={{ transform: `translateX(${d * 100}%)` }}
              onClick={onBackdropClick}
            >
              <div
                className="relative overflow-hidden"
                style={
                  isCurrent
                    ? {
                        transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`,
                        transformOrigin: "center",
                        transition: zoomAnimating ? "transform 180ms ease-out" : "none",
                      }
                    : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onImageTap(p);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isCurrent && !hidden) toggleZoomAt(rel(e.clientX, e.clientY));
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={isCurrent ? imgRef : undefined}
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

      <div
        className={`pointer-events-none absolute left-4 right-4 text-center text-white/80 transition-opacity bottom-[max(1rem,env(safe-area-inset-bottom))] ${
          zoomed ? "opacity-0" : "opacity-100"
        }`}
      >
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
