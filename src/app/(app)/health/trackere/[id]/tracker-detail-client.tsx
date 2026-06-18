"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
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
}: {
  tracker: TrackerInfo;
  initialPhotos: Photo[];
  metricData: { date: string; value: number }[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [, startDelete] = useTransition();

  const hasMetric = metricData.length > 0;
  const photoDates = useMemo(
    () => new Set(photos.map((p) => p.takenAt)),
    [photos],
  );

  // Combine metric + photo markers on same x-axis
  const chartData = useMemo(() => {
    if (!hasMetric) return [];
    return metricData.map((m) => ({
      date: m.date,
      value: m.value,
      hasPhoto: photoDates.has(m.date),
    }));
  }, [metricData, photoDates, hasMetric]);

  function removeTracker() {
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
        window.location.href = "/health/trackere";
      }
    });
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <header className="mb-6 border-b border-border pb-4">
        <Link
          href="/health/trackere"
          className="mb-2 inline-flex items-center gap-1 text-[12px] text-light hover:text-accent-bright"
        >
          <ArrowLeft className="size-3" /> Alle trackere
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-[32px] font-medium leading-none text-ink">
              {tracker.name}
            </h1>
            <p className="mt-1 text-[12px] uppercase tracking-[0.4px] text-light">
              {KIND_LABELS[tracker.kind] ?? tracker.kind}
            </p>
            {tracker.notes && (
              <p className="mt-2 text-[13px] text-mid">{tracker.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
            >
              <ImagePlus className="size-4" />
              Tilføj billede
            </button>
            <button
              type="button"
              onClick={removeTracker}
              className="cursor-pointer rounded-[3px] border border-border bg-transparent px-3 py-2 text-[12px] text-mid hover:border-danger hover:text-danger"
            >
              Slet tracker
            </button>
          </div>
        </div>
      </header>

      {hasMetric && (
        <section className="mb-5 rounded-md border border-border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between border-b border-border-light pb-2">
            <h2 className="font-serif text-[18px] text-ink">
              {KIND_LABELS[tracker.kind]} over tid
            </h2>
            <span className="text-[11px] text-light">
              {metricData.length} målinger · {photoDates.size} med billede
            </span>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--border-light)"
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
                    backgroundColor: "var(--page)",
                    border: "1px solid var(--border)",
                    borderRadius: "3px",
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
                  stroke="#5fa3f0"
                  strokeWidth={1.8}
                  dot={{ r: 2, fill: "#5fa3f0", strokeWidth: 0 }}
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
                      fill="#fbbf24"
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-light">
            <span className="mr-1 inline-block size-2 rounded-full bg-[#fbbf24] align-middle" />
            Gule prikker markerer datoer med billede
          </p>
        </section>
      )}

      <section className="rounded-md border border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between border-b border-border-light pb-2">
          <h2 className="font-serif text-[18px] text-ink">Billeder</h2>
          <span className="text-[11px] text-light">
            {photos.length} {photos.length === 1 ? "billede" : "billeder"}
          </span>
        </div>
        {photos.length === 0 ? (
          <p className="py-4 text-center text-[13px] italic text-light">
            Ingen billeder endnu — tilføj det første.
          </p>
        ) : (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {photos.map((p, i) => (
              <PhotoCard
                key={p.id}
                photo={p}
                onPick={() => setViewerIndex(i)}
                onDeleted={() =>
                  setPhotos((prev) => prev.filter((x) => x.id !== p.id))
                }
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

      {viewerIndex !== null && photos[viewerIndex] && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onChangeIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  onPick,
  onDeleted,
}: {
  photo: Photo;
  onPick: () => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Slet dette billede?")) return;
    start(async () => {
      const res = await deletePhoto(photo.id);
      if (res.ok) onDeleted();
    });
  }
  return (
    <div className="relative w-32 shrink-0">
      <button
        type="button"
        onClick={onPick}
        className="block w-full cursor-pointer overflow-hidden rounded-[3px] border border-border-light hover:border-accent-dim"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/photo/${photo.id}`}
          alt={photo.caption ?? fmtDate(photo.takenAt)}
          className="aspect-square w-full object-cover"
        />
      </button>
      <div className="mt-1 text-[11px] text-mid">{fmtDate(photo.takenAt)}</div>
      {photo.caption && (
        <div className="text-[10px] text-light line-clamp-2">{photo.caption}</div>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="absolute right-1 top-1 cursor-pointer rounded-[3px] bg-black/60 p-1 text-light hover:text-danger"
        title="Slet"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function PhotoViewer({
  photos,
  index,
  onChangeIndex,
  onClose,
}: {
  photos: Photo[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

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

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 cursor-pointer rounded-full bg-black/60 p-2 text-light hover:text-ink"
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
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-black/60 p-3 text-light hover:text-ink sm:left-6"
          title="Forrige (← pil)"
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
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-black/60 p-3 text-light hover:text-ink sm:right-6"
          title="Næste (→ pil)"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/photo/${photo.id}`}
        alt={photo.caption ?? ""}
        className="max-h-[85vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-4 left-4 right-4 text-center text-[13px] text-mid">
        <div>
          {fmtDate(photo.takenAt)}
          {photo.caption && <span> · {photo.caption}</span>}
        </div>
        <div className="mt-1 text-[11px] text-dim">
          {index + 1} / {photos.length}
        </div>
      </div>
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
      });
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-[20px] text-accent-bright">
            Tilføj billede
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-dim hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-mid">
              Billede
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-border bg-bg px-3 py-1.5 text-[13px] text-ink hover:border-accent">
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
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-border bg-bg px-3 py-1.5 text-[13px] text-ink hover:border-accent">
                <ImagePlus className="size-4" />
                Fra bibliotek
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPick(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
            </div>
            {compressing && (
              <p className="mt-2 text-[11px] italic text-light">Komprimerer...</p>
            )}
            {compressed && file && (
              <p className="mt-2 text-[11px] text-success">
                ✓ {formatFileSize(file.size)} → {formatFileSize(compressed.bytes)}
                {" "}({compressed.width}×{compressed.height})
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-mid">
                Dato taget
              </label>
              <input
                type="date"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                max={todayIso()}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-mid">
                Note (valgfri)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="fx 'lidt rødere'"
              />
            </div>
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !compressed || compressing}
              className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Uploader..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
