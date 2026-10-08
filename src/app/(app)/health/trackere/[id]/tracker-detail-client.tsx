"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Camera,
  EyeOff,
  ImagePlus,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compressImage, formatFileSize } from "@/lib/image-compress";
import { PRIVATE_BLUR_CLASS, PrivateOverlay } from "@/components/private-photo";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { deletePhoto, deleteTracker, uploadTrackerPhoto } from "../actions";

type TrackerInfo = {
  id: number;
  name: string;
  kind: string;
  notes: string | null;
  archived: boolean;
};

type Photo = {
  id: number;
  caption: string | null;
  takenAt: string;
  mimeType: string;
  sizeBytes: number;
  private: boolean;
};

const KIND_LABELS: Record<string, string> = {
  skin_spot: "Hud-plet",
  dermatitis: "Skæleksem",
  staph: "Stafylokokker",
  weight: "Vægt",
  waist: "Livvidde",
  other: "Andet",
};

const METRIC_UNITS: Record<string, string> = {
  weight: "kg",
  waist: "cm",
  dermatitis: "/5",
  staph: "/5",
};

const METRIC_DOMAINS: Record<string, [number, number] | undefined> = {
  dermatitis: [1, 5],
  staph: [1, 5],
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${d}. ${months[m - 1]} ${y}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TrackerDetailClient({
  tracker,
  initialPhotos,
  metricData,
  backTo,
}: {
  tracker: TrackerInfo;
  initialPhotos: Photo[];
  metricData: { date: string; value: number }[];
  backTo: "today" | "health";
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startDelete] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  // Afslørede private billeder — kun for denne sidevisning. Deles mellem
  // gitter og viser, så ét tryk rækker til begge; genindlæs = sløret igen.
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  function reveal(id: number) {
    setRevealed((prev) => new Set(prev).add(id));
  }
  function setPrivateLocal(id: number, isPrivate: boolean) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, private: isPrivate } : p)),
    );
  }

  const hasMetric = metricData.length > 0;
  const photoDates = useMemo(
    () => new Set(photos.map((p) => p.takenAt)),
    [photos],
  );

  // Dag-gruppering: dage nyeste først, billeder inden for en dag ældste
  // først (id stiger med upload) — så læses en dag kronologisk, mens man
  // går bagud i tiden. orderedPhotos er også lightboxens rækkefølge.
  const { days, orderedPhotos } = useMemo(() => {
    const byDate = new Map<string, Photo[]>();
    for (const p of photos) {
      const d = p.takenAt.slice(0, 10);
      const arr = byDate.get(d);
      if (arr) arr.push(p);
      else byDate.set(d, [p]);
    }
    const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
    const ordered: Photo[] = [];
    const list: PhotoDay[] = [];
    for (const date of dates) {
      const ps = [...byDate.get(date)!].sort((a, b) => a.id - b.id);
      list.push({
        date,
        photos: ps,
        cover: ps[ps.length - 1],
        firstIndex: ordered.length,
      });
      ordered.push(...ps);
    }
    return { days: list, orderedPhotos: ordered };
  }, [photos]);

  const chartData = useMemo(() => {
    if (!hasMetric) return [];
    return metricData.map((m) => ({
      date: m.date,
      value: m.value,
      hasPhoto: photoDates.has(m.date),
    }));
  }, [metricData, photoDates, hasMetric]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function removeTracker() {
    setMenuOpen(false);
    if (
      !confirm(
        `Slet trackeren "${tracker.name}" og alle ${photos.length} billeder? Dette kan ikke fortrydes.`,
      )
    ) {
      return;
    }
    startDelete(async () => {
      const res = await deleteTracker(tracker.id);
      if (res.ok) {
        window.location.href = backTo === "today" ? "/today" : "/health";
      }
    });
  }

  const backHref = backTo === "today" ? "/today" : "/health";
  const backLabel = backTo === "today" ? "I dag" : "Helbred";

  return (
    <div className="mx-auto max-w-[880px] px-4 py-6 sm:py-8">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-light hover:text-accent"
      >
        <ArrowLeft className="size-3.5" />
        {backLabel}
      </Link>

      <header className="mb-5 border-b border-hair pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
              {KIND_LABELS[tracker.kind] ?? tracker.kind}
            </div>
            <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
              {tracker.name}
            </h1>
            {tracker.notes && (
              <p className="mt-2 text-[13px] text-mid">{tracker.notes}</p>
            )}
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex cursor-pointer items-center rounded-[8px] p-2 text-mid hover:bg-bg-subtle hover:text-ink"
              aria-label="Mere"
            >
              <MoreVertical className="size-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-[10px] bg-bg-elevated p-1 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                <button
                  type="button"
                  onClick={removeTracker}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-3 py-2 text-left text-[13px] text-danger hover:bg-[var(--danger-soft)]"
                >
                  <Trash2 className="size-3.5" />
                  Slet tracker
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setShowUpload(true)}
        className="mb-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent px-4 py-3 text-[14px] font-medium text-white hover:bg-accent-bright sm:w-auto"
      >
        <ImagePlus className="size-4" />
        Tilføj billede
      </button>

      {hasMetric && (
        <section className="mb-5 rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-hair pb-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
                {KIND_LABELS[tracker.kind]} over tid
              </div>
              <div className="mt-0.5 font-serif text-[18px] leading-none text-ink">
                {metricData[metricData.length - 1]?.value.toFixed(1).replace(".", ",")}
                <span className="ml-0.5 text-[12px] text-light">
                  {METRIC_UNITS[tracker.kind] ?? ""}
                </span>
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-light">
              {metricData.length} målinger
              {photoDates.size > 0 && ` · ${photoDates.size} m. billede`}
            </span>
          </div>
          <div className="h-[180px] w-full sm:h-[220px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
              initialDimension={{ width: 600, height: 200 }}
            >
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--hair-strong)"
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--light)"
                  fontSize={10}
                  tickFormatter={(s: string) => fmtDate(s)}
                  minTickGap={36}
                />
                <YAxis
                  stroke="var(--light)"
                  fontSize={10}
                  width={40}
                  domain={METRIC_DOMAINS[tracker.kind] ?? ["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--hair-strong)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(label) =>
                    typeof label === "string" ? fmtDate(label) : String(label)
                  }
                  formatter={(value) => [
                    `${value}${METRIC_UNITS[tracker.kind] ?? ""}`,
                    KIND_LABELS[tracker.kind],
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  dot={{ r: 2, fill: "var(--accent)", strokeWidth: 0 }}
                  isAnimationActive={false}
                />
                {chartData
                  .filter((d) => d.hasPhoto)
                  .map((d) => (
                    <ReferenceDot
                      key={d.date}
                      x={d.date}
                      y={d.value}
                      r={5}
                      fill="var(--warning)"
                      stroke="var(--bg-elevated)"
                      strokeWidth={1}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-light">
            <span className="inline-block size-2 rounded-full bg-[var(--warning)]" />
            Datoer med billede
          </p>
        </section>
      )}

      <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-hair pb-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Billeder
            </div>
            <h2 className="mt-0.5 font-serif text-[18px] leading-none text-ink">
              {photos.length === 0
                ? "Ingen billeder endnu"
                : `${photos.length} ${photos.length === 1 ? "billede" : "billeder"}${
                    days.length < photos.length ? ` · ${days.length} dage` : ""
                  }`}
            </h2>
          </div>
        </div>
        {photos.length === 0 ? (
          <p className="py-6 text-center text-[13px] italic text-light">
            Tryk &quot;Tilføj billede&quot; for at oprette det første.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {days.map((d) => (
              <DayCard
                key={d.date}
                day={d}
                // Er bare ét af dagens billeder privat, sløres forsiden.
                hidden={
                  d.photos.some((p) => p.private) && !revealed.has(d.cover.id)
                }
                onReveal={() => reveal(d.cover.id)}
                onPick={() => setViewerIndex(d.firstIndex)}
              />
            ))}
          </div>
        )}
      </section>

      {showUpload && (
        <UploadDialog
          trackerId={tracker.id}
          onClose={() => setShowUpload(false)}
          onUploaded={(p) => {
            setPhotos((prev) =>
              [...prev, p].sort((a, b) => b.takenAt.localeCompare(a.takenAt)),
            );
            setShowUpload(false);
          }}
        />
      )}

      {viewerIndex !== null && orderedPhotos[viewerIndex] && (
        <PhotoLightbox
          photos={orderedPhotos}
          index={viewerIndex}
          dayGroups
          revealed={revealed}
          onReveal={reveal}
          onPrivateChanged={setPrivateLocal}
          onDelete={async (id) => {
            const res = await deletePhoto(id);
            if (!res.ok) return;
            const remaining = orderedPhotos.length - 1;
            setPhotos((prev) => prev.filter((p) => p.id !== id));
            setViewerIndex((i) =>
              i === null || remaining === 0 ? null : Math.min(i, remaining - 1),
            );
          }}
          onChangeIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

// Ét kort per dag: dagens nyeste billede som forside og et tal, når der
// er flere. Handlinger (privat/slet) bor i lightboxen, hvor man ser
// præcis hvilket billede det gælder.
type PhotoDay = {
  date: string;
  photos: Photo[];
  cover: Photo;
  firstIndex: number;
};

function DayCard({
  day,
  hidden,
  onReveal,
  onPick,
}: {
  day: PhotoDay;
  // Privat og endnu ikke afsløret: første tryk viser, næste åbner dagen.
  hidden: boolean;
  onReveal: () => void;
  onPick: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={hidden ? onReveal : onPick}
        title={hidden ? "Privat — tryk for at vise" : undefined}
        className="group relative block w-full cursor-pointer overflow-hidden rounded-[10px] bg-bg-subtle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/photo/${day.cover.id}`}
          alt={day.cover.caption ?? fmtDate(day.date)}
          className={`aspect-square w-full object-cover transition-transform group-hover:scale-[1.02] ${
            hidden ? PRIVATE_BLUR_CLASS : ""
          }`}
        />
        {hidden && <PrivateOverlay compact />}
        {day.photos.length > 1 && (
          <span className="absolute right-1.5 top-1.5 inline-flex min-w-[22px] items-center justify-center rounded-full bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {day.photos.length}
          </span>
        )}
      </button>
      <div className="mt-1.5 text-[11px] font-medium text-mid">
        {fmtDate(day.date)}
      </div>
      {day.cover.caption && (
        <div className="line-clamp-2 text-[10px] text-light">
          {day.cover.caption}
        </div>
      )}
    </div>
  );
}

function UploadDialog({
  trackerId,
  onClose,
  onUploaded,
}: {
  trackerId: number;
  onClose: () => void;
  onUploaded: (p: Photo) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressed, setCompressed] = useState<{
    blob: Blob;
    bytes: number;
    width: number;
    height: number;
  } | null>(null);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState(todayIso());
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onPick(f: File | undefined) {
    setError(null);
    setCompressed(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("Vælg en billede-fil");
      return;
    }
    setFile(f);
    setCompressing(true);
    try {
      const result = await compressImage(f);
      setCompressed({
        blob: result.blob,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
      });
    } catch (err) {
      setError(`Komprimering fejlede: ${err instanceof Error ? err.message : "ukendt fejl"}`);
    } finally {
      setCompressing(false);
    }
  }

  function submit() {
    if (!file || !compressed) {
      setError("Vælg en fil først");
      return;
    }
    setError(null);

    const compressedFile = new File(
      [compressed.blob],
      file.name.replace(/\.[^.]+$/, ".jpg"),
      { type: "image/jpeg" },
    );
    const fd = new FormData();
    fd.append("file", compressedFile);
    fd.append("trackerId", String(trackerId));
    fd.append("caption", caption.trim());
    fd.append("takenAt", takenAt);
    fd.append("private", isPrivate ? "1" : "0");

    start(async () => {
      const res = await uploadTrackerPhoto(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onUploaded({
        id: res.id,
        caption: caption.trim() || null,
        takenAt,
        mimeType: "image/jpeg",
        sizeBytes: compressed.bytes,
        private: isPrivate,
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
              Nyt billede
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              Tilføj billede
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
              Billede
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-bg-subtle px-3 py-2.5 text-[13px] text-ink hover:bg-bg">
                <Camera className="size-4" />
                Tag billede
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => onPick(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
              <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-bg-subtle px-3 py-2.5 text-[13px] text-ink hover:bg-bg">
                <ImagePlus className="size-4" />
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
              <p className="mt-2 text-[11px] italic text-light">Komprimerer…</p>
            )}
            {compressed && file && (
              <p className="mt-2 text-[11px] text-success">
                {formatFileSize(file.size)} → {formatFileSize(compressed.bytes)}
                {" "}({compressed.width}×{compressed.height})
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Dato taget
            </label>
            <input
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              max={todayIso()}
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Note <span className="normal-case tracking-normal text-dim">— valgfri</span>
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="fx 'lidt rødere'"
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            />
          </div>

          <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[13px] text-mid">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="size-4"
            />
            <span className="inline-flex items-center gap-1.5">
              <EyeOff className="size-3.5" />
              Privat — vises sløret, indtil du trykker
            </span>
          </label>

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
              disabled={pending || !compressed || compressing}
              className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Uploader…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
