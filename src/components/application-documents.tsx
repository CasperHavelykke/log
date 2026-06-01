"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FileText, Paperclip, Plus, Upload, X } from "lucide-react";
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

function extractableHint(mime: string | undefined): string | null {
  if (!mime) return null;
  if (
    mime === "application/pdf" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/html" ||
    mime === "text/plain" ||
    mime === "text/markdown"
  ) {
    return "Teksten ekstraheres ved upload — AI kan så læse den.";
  }
  return null;
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
    <div className={compact ? "" : "rounded-[3px] border border-border-light bg-bg p-3"}>
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

      <div className={`flex flex-wrap gap-2 ${attached.length > 0 || !compact ? "mt-2" : ""}`}>
        {mode !== "attach" && (
          <button
            type="button"
            onClick={() => setMode("attach")}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[3px] border border-dashed border-border bg-transparent px-2 py-1 text-[12px] text-light hover:border-accent hover:text-accent-bright"
          >
            <Paperclip className="size-3.5" />
            Tilknyt eksisterende
          </button>
        )}
        {mode !== "upload" && (
          <button
            type="button"
            onClick={() => setMode("upload")}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[3px] border border-dashed border-border bg-transparent px-2 py-1 text-[12px] text-light hover:border-accent hover:text-accent-bright"
          >
            <Upload className="size-3.5" />
            Upload ny
          </button>
        )}
      </div>

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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-card px-2 py-0.5 text-[12px]">
      <FileText className="size-3 text-light" />
      <a
        href={`/api/files/document/${doc.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink hover:text-accent-bright"
        title={`${KIND_LABELS[doc.kind] ?? doc.kind} · ${doc.filename}`}
      >
        {doc.title}
      </a>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="cursor-pointer text-dim hover:text-danger"
        title="Fjern tilknytning"
      >
        <X className="size-3" />
      </button>
    </span>
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
    <div className="mt-2 space-y-2 rounded-[3px] border border-border-light bg-card p-2">
      {available.length === 0 ? (
        <p className="text-[12px] italic text-light">
          Ingen tilgængelige dokumenter — upload en ny i stedet, eller gå til{" "}
          <a href="/documents" className="text-accent-bright hover:underline">
            /documents
          </a>{" "}
          for at oprette dem først.
        </p>
      ) : (
        <>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="!text-[12px] !py-1"
          >
            <option value="">— Vælg dokument —</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                [{KIND_LABELS[d.kind] ?? d.kind}] {d.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !selectedId}
              className="cursor-pointer rounded-[3px] border border-accent bg-accent px-3 py-1 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "..." : "Tilknyt"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
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

  const hint = file ? extractableHint(file.type) : null;

  return (
    <div className="mt-2 space-y-2 rounded-[3px] border border-border-light bg-card p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="!w-auto !text-[12px] !py-1"
        >
          <option value="application">Ansøgning</option>
          <option value="cv">CV</option>
          <option value="job_posting">Job-opslag</option>
          <option value="reference">Reference</option>
          <option value="other">Andet</option>
        </select>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => onPick(e.target.files?.[0])}
          className="!text-[12px] file:mr-2 file:cursor-pointer file:rounded-[3px] file:border file:border-border file:bg-bg file:px-2 file:py-1 file:text-[12px] file:text-ink"
        />
      </div>
      {file && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel"
          className="!text-[12px] !py-1"
        />
      )}
      {hint && <p className="text-[11px] italic text-success">{hint}</p>}
      {file && !hint && (
        <p className="text-[11px] italic text-light">
          Bevares som er — ingen tekst-ekstraktion for denne filtype.
        </p>
      )}
      <p className="text-[11px] text-dim">
        Max 10 MB. PDF, DOCX, HTML, MD, TXT.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !file}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-3 py-1 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Uploader..." : "Upload + tilknyt"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-[12px] text-mid hover:text-ink"
        >
          Annullér
        </button>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
