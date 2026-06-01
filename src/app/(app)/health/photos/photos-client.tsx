"use client";

import { useMemo, useState, useTransition } from "react";
import { Camera, Trash2, X, ImagePlus } from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/image-compress";
import { deletePhoto, uploadPhoto } from "./actions";

type Photo = {
  id: number;
  category: string;
  bodyArea: string | null;
  caption: string | null;
  blobUrl: string;
  takenAt: string;
  sizeBytes: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  skin_spot: "Hud-plet",
  body_progress: "Krops-progression",
  other: "Andet",
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "jan", "feb", "mar", "apr", "maj", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  return `${d}. ${months[m - 1]} ${y}`;
}

type Group = {
  key: string;
  label: string;
  category: string;
  photos: Photo[];
};

function groupPhotos(photos: Photo[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of photos) {
    const area = p.bodyArea?.trim() || "(uden kropsdel)";
    const key = `${p.category}::${area}`;
    let group = map.get(key);
    if (!group) {
      group = { key, label: area, category: p.category, photos: [] };
      map.set(key, group);
    }
    group.photos.push(p);
  }
  for (const g of map.values()) {
    g.photos.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  }
  return [...map.values()].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.label.localeCompare(b.label);
  });
}

export function PhotosClient({
  initialPhotos,
  knownBodyAreas,
}: {
  initialPhotos: Photo[];
  knownBodyAreas: string[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<Photo | null>(null);

  const groups = useMemo(() => groupPhotos(photos), [photos]);

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <h1 className="font-serif text-[32px] font-medium leading-none text-ink">
          Billeder
        </h1>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <ImagePlus className="size-4" />
          Tilføj billede
        </button>
      </header>

      <p className="mb-5 text-[13px] text-mid">
        Tag månedlige billeder af hud-pletter, vægt-progression, eller hvad du
        vil følge over tid. Hver kropsdel får sin egen tidslinje.
      </p>

      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-6 py-12 text-center text-[13px] italic text-light">
          Ingen billeder endnu — tilføj dit første.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <PhotoGroup
              key={g.key}
              group={g}
              onPick={(p) => setViewerPhoto(p)}
              onDeleted={(id) =>
                setPhotos((prev) => prev.filter((p) => p.id !== id))
              }
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          knownBodyAreas={knownBodyAreas}
          onClose={() => setShowUpload(false)}
          onUploaded={(p) => {
            setPhotos((prev) => [...prev, p]);
            setShowUpload(false);
          }}
        />
      )}

      {viewerPhoto && (
        <PhotoViewer
          photo={viewerPhoto}
          onClose={() => setViewerPhoto(null)}
        />
      )}
    </div>
  );
}

function PhotoGroup({
  group,
  onPick,
  onDeleted,
}: {
  group: Group;
  onPick: (p: Photo) => void;
  onDeleted: (id: number) => void;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between border-b border-border-light pb-2">
        <div>
          <span className="font-serif text-[18px] text-ink">{group.label}</span>
          <span className="ml-2 text-[11px] text-light">
            {CATEGORY_LABELS[group.category] ?? group.category}
          </span>
        </div>
        <span className="text-[12px] text-mid">
          {group.photos.length} {group.photos.length === 1 ? "billede" : "billeder"}
        </span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {group.photos.map((p) => (
          <PhotoCard
            key={p.id}
            photo={p}
            onPick={() => onPick(p)}
            onDeleted={() => onDeleted(p.id)}
          />
        ))}
      </div>
    </section>
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
          src={photo.blobUrl}
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
  photo,
  onClose,
}: {
  photo: Photo;
  onClose: () => void;
}) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.blobUrl}
        alt={photo.caption ?? ""}
        className="max-h-[90vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-4 left-4 right-4 text-center text-[13px] text-mid">
        {fmtDate(photo.takenAt)}
        {photo.caption && <span> · {photo.caption}</span>}
      </div>
    </div>
  );
}

function UploadDialog({
  knownBodyAreas,
  onClose,
  onUploaded,
}: {
  knownBodyAreas: string[];
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
  const [category, setCategory] = useState<string>("skin_spot");
  const [bodyArea, setBodyArea] = useState("");
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

    const compressedFile = new File([compressed.blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
    const fd = new FormData();
    fd.append("file", compressedFile);
    fd.append("category", category);
    fd.append("bodyArea", bodyArea.trim());
    fd.append("caption", caption.trim());
    fd.append("takenAt", takenAt);

    start(async () => {
      const res = await uploadPhoto(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onUploaded({
        id: res.id,
        category,
        bodyArea: bodyArea.trim() || null,
        caption: caption.trim() || null,
        blobUrl: res.url,
        takenAt,
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
                ✓ Komprimeret: {formatFileSize(file.size)} → {formatFileSize(compressed.bytes)}
                {" "}({compressed.width}×{compressed.height})
              </p>
            )}
            <p className="mt-1 text-[11px] italic text-dim">
              Bevares som visuel reference — ingen tekst-ekstraktion. Maks 2048px,
              komprimeres til JPEG.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-mid">
              Kategori
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="skin_spot">Hud-plet</option>
              <option value="body_progress">Krops-progression</option>
              <option value="other">Andet</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-mid">
              Kropsdel
            </label>
            <input
              type="text"
              value={bodyArea}
              onChange={(e) => setBodyArea(e.target.value)}
              placeholder="fx 'venstre underarm'"
              list="body-areas"
            />
            {knownBodyAreas.length > 0 && (
              <datalist id="body-areas">
                {knownBodyAreas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
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
                placeholder="fx 'lidt rødere end sidst'"
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
