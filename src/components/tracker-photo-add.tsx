"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Camera, ChevronDown, ChevronRight, ImagePlus, X } from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/image-compress";
import { uploadTrackerPhoto } from "@/app/(app)/health/trackere/actions";

export type TrackerRef = {
  id: number;
  name: string;
  kind: string;
};

const KIND_LABELS: Record<string, string> = {
  skin_spot: "Hud-plet",
  dermatitis: "Skæleksem",
  staph: "Stafylokokker",
  weight: "Vægt",
  waist: "Livvidde",
  other: "Andet",
};

export function TrackerPhotoAdd({
  date,
  trackers,
  defaultExpanded = false,
}: {
  date: string;
  trackers: TrackerRef[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>("");
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
      setError("Vælg en billede-fil");
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
    if (!selectedTrackerId) {
      setError("Vælg en tracker");
      return;
    }
    if (!file || !compressed) {
      setError("Vælg en fil");
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
    fd.append("trackerId", selectedTrackerId);
    fd.append("caption", caption.trim());
    fd.append("takenAt", date);

    start(async () => {
      const res = await uploadTrackerPhoto(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const tracker = trackers.find((t) => t.id === Number(selectedTrackerId));
      setSuccess(`✓ Tilføjet til ${tracker?.name ?? "tracker"}`);
      setFile(null);
      setCompressed(null);
      setCaption("");
      setTimeout(() => setSuccess(null), 4000);
    });
  }

  const photoCount = 0; // could pass in, but kept simple

  if (trackers.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between rounded-[3px] border border-border-light bg-bg px-3 py-2 text-[12px] text-light hover:border-accent-dim"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          📷 Billeder
        </span>
        {expanded && (
          <Link
            href="/health/trackere"
            className="text-accent-bright hover:underline"
          >
            Opret tracker først →
          </Link>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-[3px] border border-border-light bg-bg">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-[12px] text-light hover:text-ink"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          📷 Tilføj billede til en tracker
        </span>
        {!expanded && (
          <span className="text-[11px] text-dim">{trackers.length} trackere</span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border-light p-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-mid">
              Tracker
            </label>
            <select
              value={selectedTrackerId}
              onChange={(e) => setSelectedTrackerId(e.target.value)}
              className="!text-[12px] !py-1"
            >
              <option value="">— Vælg —</option>
              {trackers.map((t) => (
                <option key={t.id} value={t.id}>
                  [{KIND_LABELS[t.kind] ?? t.kind}] {t.name}
                </option>
              ))}
            </select>
          </div>

          {selectedTrackerId && (
            <>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border border-border bg-card px-2 py-1 text-[12px] text-ink hover:border-accent">
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
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border border-border bg-card px-2 py-1 text-[12px] text-ink hover:border-accent">
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
                <p className="text-[11px] italic text-light">Komprimerer...</p>
              )}
              {compressed && file && (
                <p className="text-[11px] text-success">
                  ✓ {formatFileSize(file.size)} → {formatFileSize(compressed.bytes)}
                </p>
              )}
              {compressed && (
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Note (valgfri)"
                  className="!text-[12px] !py-1"
                />
              )}
              {compressed && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="cursor-pointer rounded-[3px] border border-accent bg-accent px-3 py-1 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
                >
                  {pending ? "Uploader..." : "Upload"}
                </button>
              )}
            </>
          )}

          {error && <p className="text-[12px] text-danger">{error}</p>}
          {success && <p className="text-[12px] text-success">{success}</p>}
        </div>
      )}
    </div>
  );
}
