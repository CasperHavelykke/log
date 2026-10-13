"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  ImagePlus,
  MoreVertical,
  Pencil,
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
import { readExifDate } from "@/lib/exif-date";
import { PRIVATE_BLUR_CLASS, PrivateOverlay } from "@/components/private-photo";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { TrackerName } from "@/components/tracker-name";
import {
  deletePhoto,
  deleteTracker,
  updateTracker,
  uploadTrackerPhoto,
} from "../actions";

type TrackerInfo = {
  id: number;
  name: string;
  kind: string;
  notes: string | null;
  archived: boolean;
  private: boolean;
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

const KIND_ORDER = [
  "skin_spot",
  "dermatitis",
  "staph",
  "weight",
  "waist",
  "other",
] as const;

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
  const [showEdit, setShowEdit] = useState(false);
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
  // "Vis private": afslør alle på én gang i denne sidevisning — det er
  // trættende at trykke på hvert billede, når man selv sidder med appen.
  const [revealAll, setRevealAll] = useState(false);
  const hasPrivate = tracker.private || photos.some((p) => p.private);
  const revealedAll = useMemo(
    () => (revealAll ? new Set(photos.map((p) => p.id)) : revealed),
    [revealAll, revealed, photos],
  );
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

  const router = useRouter();
  const backHref = backTo === "today" ? "/today" : "/health";
  const backLabel = backTo === "today" ? "I dag" : "Helbred";

  // "I dag"-linket findes kun med ?from=today, altså når man kom hertil
  // fra /today. Så er browserens tilbage det rigtige: den husker scroll-
  // positionen, hvor et nyt link ville starte i toppen. Uden historik
  // (siden åbnet direkte) falder vi tilbage til et almindeligt link.
  function onBack(e: React.MouseEvent) {
    if (backTo !== "today" || window.history.length <= 1) return;
    e.preventDefault();
    router.back();
  }

  return (
    <div className="mx-auto max-w-[880px] px-4 py-6 sm:py-8">
      <Link
        href={backHref}
        onClick={onBack}
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
              <TrackerName
                name={tracker.name}
                hidden={tracker.private}
                forceReveal={revealAll}
              />
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
                  onClick={() => {
                    setMenuOpen(false);
                    setShowEdit(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-3 py-2 text-left text-[13px] text-ink hover:bg-bg"
                >
                  <Pencil className="size-3.5" />
                  Redigér
                </button>
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
          {hasPrivate && (
            <button
              type="button"
              onClick={() => setRevealAll((v) => !v)}
              aria-pressed={revealAll}
              className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] text-mid hover:bg-bg-subtle hover:text-ink"
            >
              {revealAll ? (
                <>
                  <EyeOff className="size-3.5" />
                  Skjul private
                </>
              ) : (
                <>
                  <Eye className="size-3.5" />
                  Vis private
                </>
              )}
            </button>
          )}
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
                  (tracker.private || d.photos.some((p) => p.private)) &&
                  !revealedAll.has(d.cover.id)
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
          onUploaded={(p) =>
            setPhotos((prev) =>
              [...prev, p].sort((a, b) => b.takenAt.localeCompare(a.takenAt)),
            )
          }
        />
      )}

      {showEdit && (
        <EditTrackerDialog
          tracker={tracker}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}

      {viewerIndex !== null && orderedPhotos[viewerIndex] && (
        <PhotoLightbox
          photos={orderedPhotos}
          index={viewerIndex}
          dayGroups
          privateLocked={tracker.private}
          revealed={revealedAll}
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

// Flere billeder ad gangen. Hvert billede komprimeres for sig (i række —
// parallelt kan vælte Safari på hukommelse), får sin dato fra EXIF hvis
// den findes (ellers i dag) og kan rettes per billede. Note og privat-
// flaget gælder hele bunken. Upload sker én fil ad gangen mod den
// eksisterende server-handling, så én fejl ikke vælter resten.
type UploadItem = {
  key: number;
  file: File;
  previewUrl: string;
  status: "compressing" | "ready" | "uploading" | "done" | "error";
  blob: Blob | null;
  bytes: number;
  takenAt: string;
  fromExif: boolean;
  error: string | null;
};

let uploadKeySeq = 0;

function UploadDialog({
  trackerId,
  onClose,
  onUploaded,
}: {
  trackerId: number;
  onClose: () => void;
  onUploaded: (p: Photo) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [caption, setCaption] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Komprimeringskø: nye valg stilles bag igangværende, aldrig ved siden af.
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Preview-URL'er frigives, når dialogen lukkes (ref holdes ajour i en
  // effect — ikke under render).
  const itemsRef = useRef<UploadItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) URL.revokeObjectURL(it.previewUrl);
    };
  }, []);

  function update(key: number, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    if (files.length < list.length) setError("Kun billedfiler kan tilføjes");
    const fresh: UploadItem[] = files.map((file) => ({
      key: ++uploadKeySeq,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "compressing",
      blob: null,
      bytes: 0,
      takenAt: todayIso(),
      fromExif: false,
      error: null,
    }));
    setItems((prev) => [...prev, ...fresh]);
    queue.current = queue.current.then(async () => {
      for (const it of fresh) {
        const exif = await readExifDate(it.file);
        if (exif) update(it.key, { takenAt: exif, fromExif: true });
        try {
          const result = await compressImage(it.file);
          update(it.key, { status: "ready", blob: result.blob, bytes: result.bytes });
        } catch (err) {
          update(it.key, {
            status: "error",
            error: `Komprimering fejlede: ${err instanceof Error ? err.message : "ukendt fejl"}`,
          });
        }
      }
    });
  }

  function removeItem(key: number) {
    setItems((prev) => {
      const it = prev.find((x) => x.key === key);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.key !== key);
    });
  }

  const readyCount = items.filter((it) => it.status === "ready").length;
  const busy = items.some((it) => it.status === "compressing");

  function submit() {
    const ready = items.filter((it) => it.status === "ready");
    if (ready.length === 0) {
      setError("Vælg mindst ét billede");
      return;
    }
    if (ready.some((it) => !/^\d{4}-\d{2}-\d{2}$/.test(it.takenAt))) {
      setError("Alle billeder skal have en gyldig dato");
      return;
    }
    setError(null);
    start(async () => {
      let failed = 0;
      for (const it of ready) {
        update(it.key, { status: "uploading" });
        const compressedFile = new File(
          [it.blob!],
          it.file.name.replace(/\.[^.]+$/, ".jpg"),
          { type: "image/jpeg" },
        );
        const fd = new FormData();
        fd.append("file", compressedFile);
        fd.append("trackerId", String(trackerId));
        fd.append("caption", caption.trim());
        fd.append("takenAt", it.takenAt);
        fd.append("private", isPrivate ? "1" : "0");
        const res = await uploadTrackerPhoto(fd);
        if (!res.ok) {
          failed++;
          update(it.key, { status: "error", error: res.error });
          continue;
        }
        onUploaded({
          id: res.id,
          caption: caption.trim() || null,
          takenAt: it.takenAt,
          mimeType: "image/jpeg",
          sizeBytes: it.bytes,
          private: isPrivate,
        });
        update(it.key, { status: "done" });
      }
      if (failed === 0) {
        onClose();
      } else {
        // Behold kun dem, der fejlede, så man kan prøve igen.
        setItems((prev) => prev.filter((it) => it.status !== "done"));
        setError(`${failed} ${failed === 1 ? "billede" : "billeder"} kunne ikke uploades`);
      }
    });
  }

  const today = todayIso();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Nye billeder
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              Tilføj billeder
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
              Billeder
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-bg-subtle px-3 py-2.5 text-[13px] text-ink hover:bg-bg">
                <Camera className="size-4" />
                Tag billede
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    onPick(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-bg-subtle px-3 py-2.5 text-[13px] text-ink hover:bg-bg">
                <ImagePlus className="size-4" />
                Bibliotek
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    onPick(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] italic text-light">
              Vælg gerne flere ad gangen. Datoen hentes fra billedet, når den
              findes — ret den, hvis den er forkert.
            </p>
          </div>

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.key}
                  className="flex items-center gap-3 rounded-[10px] bg-bg-subtle p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.previewUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-[8px] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-ink">{it.file.name}</div>
                    <div className="text-[11px] text-light">
                      {it.status === "compressing" && "Komprimerer…"}
                      {it.status === "ready" &&
                        `${formatFileSize(it.file.size)} → ${formatFileSize(it.bytes)}`}
                      {it.status === "uploading" && "Uploader…"}
                      {it.status === "done" && "Uploadet"}
                      {it.status === "error" && (
                        <span className="text-danger">{it.error}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="date"
                        value={it.takenAt}
                        max={today}
                        onChange={(e) =>
                          update(it.key, { takenAt: e.target.value, fromExif: false })
                        }
                        disabled={it.status === "uploading" || it.status === "done"}
                        className={`!w-auto min-w-0 !rounded-[8px] !border-hair !bg-bg !py-1 !text-[12px] ${
                          it.takenAt !== today ? "!text-warning" : ""
                        }`}
                      />
                      <span className="text-[10px] text-light">
                        {it.fromExif ? "fra billedet" : it.takenAt === today ? "i dag" : "rettet"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    disabled={it.status === "uploading"}
                    aria-label="Fjern"
                    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:bg-bg hover:text-danger disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Note <span className="normal-case tracking-normal text-dim">— valgfri, gælder alle</span>
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
              Private — vises slørede, indtil du trykker
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
              disabled={pending || busy || readyCount === 0}
              className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending
                ? "Uploader…"
                : readyCount > 1
                  ? `Upload ${readyCount} billeder`
                  : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Redigér navn, type, noter og skjult-flag. Serveren er sandheden —
// efter gem genindlæses siden (router.refresh), så header og billeder
// følger med.
function EditTrackerDialog({
  tracker,
  onClose,
  onSaved,
}: {
  tracker: TrackerInfo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(tracker.name);
  const [kind, setKind] = useState(tracker.kind);
  const [notes, setNotes] = useState(tracker.notes ?? "");
  const [isPrivate, setIsPrivate] = useState(tracker.private);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!name.trim()) {
      setError("Giv trackeren et navn");
      return;
    }
    setError(null);
    start(async () => {
      const res = await updateTracker({
        id: tracker.id,
        name: name.trim(),
        kind: kind as (typeof KIND_ORDER)[number],
        notes: notes.trim() || null,
        private: isPrivate,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
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
              Tracker
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              Redigér
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
              maxLength={120}
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
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Noter <span className="normal-case tracking-normal text-dim">— valgfri</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            />
          </div>
          <label className="flex min-h-[40px] cursor-pointer items-start gap-2 text-[13px] text-mid">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="inline-flex items-center gap-1.5 text-ink">
                <EyeOff className="size-3.5" />
                Skjult
              </span>
              <span className="block text-[11px] text-light">
                Navnet vises som &quot;Skjult&quot;, og alle billeder sløres,
                indtil du trykker på dem.
              </span>
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
              onClick={save}
              disabled={pending}
              className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Gemmer…" : "Gem"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
