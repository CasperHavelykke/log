"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Paperclip, Upload, X } from "lucide-react";
import {
  attachDocument,
  detachDocument,
  uploadDocument,
} from "@/app/(app)/documents/actions";

export type DocSummary = {
  id: number;
  title: string;
  kind: string;
  filename: string;
  mimeType: string;
};

const KIND_LABELS: Record<string, string> = {
  application: "Ansøgning",
  cv: "CV",
  job_posting: "Job-opslag",
  reference: "Reference",
  other: "Andet",
};

const ACCEPT =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,text/html,.html,.md";

function isExtractable(mime: string | undefined): boolean {
  if (!mime) return false;
  return (
    mime === "application/pdf" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/html" ||
    mime === "text/plain" ||
    mime === "text/markdown"
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function ApplicationDocuments({
  applicationId,
  attached,
  availableForAttach,
  onChange,
  compact = false,
}: {
  applicationId: number;
  attached: DocSummary[];
  availableForAttach: DocSummary[];
  onChange: (next: DocSummary[]) => void;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "attach" | "upload">("idle");

  return (
    <div>
      {attached.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {attached.map((d) => (
            <AttachedChip
              key={d.id}
              doc={d}
              onDetach={() =>
                onChange(attached.filter((x) => x.id !== d.id))
              }
            />
          ))}
        </div>
      ) : (
        !compact && (
          <p className="text-[12px] italic text-light">
            Ingen dokumenter tilknyttet.
          </p>
        )
      )}

      {mode === "idle" && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("attach")}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-dashed border-hair-strong px-2.5 py-1.5 text-[12px] text-light hover:border-accent hover:text-accent"
          >
            <Paperclip className="size-3.5" />
            Tilknyt eksisterende
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-dashed border-hair-strong px-2.5 py-1.5 text-[12px] text-light hover:border-accent hover:text-accent"
          >
            <Upload className="size-3.5" />
            Upload ny
          </button>
        </div>
      )}

      {mode === "attach" && (
        <AttachPicker
          applicationId={applicationId}
          available={availableForAttach}
          onAttached={(d) => {
            onChange([...attached, d]);
            setMode("idle");
          }}
          onCancel={() => setMode("idle")}
        />
      )}

      {mode === "upload" && (
        <UploadInline
          applicationId={applicationId}
          onUploaded={(d) => {
            onChange([...attached, d]);
            setMode("idle");
          }}
          onCancel={() => setMode("idle")}
        />
      )}
    </div>
  );
}

function AttachedChip({
  doc,
  onDetach,
}: {
  doc: DocSummary;
  onDetach: () => void;
}) {
  const [pending, start] = useTransition();
  function remove() {
    start(async () => {
      await detachDocument(doc.id);
      onDetach();
    });
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-hair bg-bg-subtle py-1 pl-2.5 pr-2 text-[12px]">
      <FileText className="size-3 shrink-0 text-light" />
      <a
        href={`/api/files/document/${doc.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate text-ink hover:text-accent-bright"
        title={`${KIND_LABELS[doc.kind] ?? doc.kind} · ${doc.filename}`}
      >
        {doc.title}
      </a>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="shrink-0 cursor-pointer p-0.5 text-dim hover:text-danger"
        title="Fjern tilknytning"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function PanelFooter({
  submitLabel,
  pendingLabel,
  pending,
  disabled,
  onSubmit,
  onCancel,
}: {
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  disabled: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="cursor-pointer rounded-[8px] bg-accent px-3.5 py-2 text-[12px] font-medium text-white hover:bg-accent-bright disabled:cursor-default disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:bg-bg-elevated hover:text-ink"
      >
        Annullér
      </button>
    </div>
  );
}

function AttachPicker({
  applicationId,
  available,
  onAttached,
  onCancel,
}: {
  applicationId: number;
  available: DocSummary[];
  onAttached: (d: DocSummary) => void;
  onCancel: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const id = Number(selectedId);
    if (!Number.isFinite(id)) return;
    const doc = available.find((d) => d.id === id);
    if (!doc) return;
    setError(null);
    start(async () => {
      const res = await attachDocument({
        documentId: id,
        jobApplicationId: applicationId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAttached(doc);
    });
  }

  return (
    <div className="mt-2.5 space-y-2.5 rounded-[8px] border border-hair bg-bg-subtle p-3">
      {available.length === 0 ? (
        <>
          <p className="text-[12px] italic text-light">
            Ingen tilgængelige dokumenter — upload en ny i stedet, eller opret
            dem først under{" "}
            <a href="/documents" className="text-accent-bright hover:underline">
              Dokumenter
            </a>
            .
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:bg-bg-elevated hover:text-ink"
          >
            Annullér
          </button>
        </>
      ) : (
        <>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="!rounded-[8px] !border-hair !bg-bg-elevated !text-[13px]"
          >
            <option value="">— Vælg dokument —</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                [{KIND_LABELS[d.kind] ?? d.kind}] {d.title}
              </option>
            ))}
          </select>
          <PanelFooter
            submitLabel="Tilknyt"
            pendingLabel="Tilknytter…"
            pending={pending}
            disabled={pending || !selectedId}
            onSubmit={submit}
            onCancel={onCancel}
          />
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}

function UploadInline({
  applicationId,
  onUploaded,
  onCancel,
}: {
  applicationId: number;
  onUploaded: (d: DocSummary) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<string>("application");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(f: File | undefined) {
    setFile(f ?? null);
    setError(null);
    if (f && !title) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  }

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit() {
    if (!file) {
      setError("Vælg en fil");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fd.append("title", title.trim() || file.name);
    fd.append("jobApplicationId", String(applicationId));

    start(async () => {
      const res = await uploadDocument(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onUploaded({
        id: res.id,
        kind,
        title: title.trim() || file.name,
        filename: file.name,
        mimeType: file.type,
      });
    });
  }

  return (
    <div className="mt-2.5 space-y-2.5 rounded-[8px] border border-hair bg-bg-subtle p-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={(e) => onPick(e.target.files?.[0])}
        className="hidden"
      />

      {/* Fil-flade: samme højde uanset om der er valgt en fil, så panelet
          ikke hopper i størrelse. */}
      {file ? (
        <div className="flex min-h-[58px] items-center gap-2.5 rounded-[8px] border border-hair bg-bg-elevated px-3 py-2">
          <FileText className="size-4 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink">
              {file.name}
            </div>
            <div className="truncate text-[11px] text-light">
              {formatSize(file.size)}
              {isExtractable(file.type)
                ? " · teksten ekstraheres, så AI kan læse den"
                : " · gemmes som den er"}
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="shrink-0 cursor-pointer p-1 text-dim hover:text-danger"
            title="Fjern fil"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[58px] w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[8px] border border-dashed border-hair-strong px-3 py-2 text-mid hover:border-accent hover:text-accent"
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
            <Upload className="size-3.5" />
            Vælg fil
          </span>
          <span className="text-[11px] text-light">
            PDF, DOCX, HTML, MD, TXT · max 10 MB
          </span>
        </button>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="!w-auto !rounded-[8px] !border-hair !bg-bg-elevated !text-[13px]"
        >
          <option value="application">Ansøgning</option>
          <option value="cv">CV</option>
          <option value="job_posting">Job-opslag</option>
          <option value="reference">Reference</option>
          <option value="other">Andet</option>
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel"
          className="!rounded-[8px] !border-hair !bg-bg-elevated !text-[13px]"
        />
      </div>

      <PanelFooter
        submitLabel="Upload + tilknyt"
        pendingLabel="Uploader…"
        pending={pending}
        disabled={pending || !file}
        onSubmit={submit}
        onCancel={onCancel}
      />
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
