"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText, Search, Trash2, Upload, X } from "lucide-react";
import { deleteDocument, uploadDocument } from "./actions";

type Doc = {
  id: number;
  kind: string;
  title: string;
  filename: string;
  blobUrl: string;
  mimeType: string;
  sizeBytes: number;
  hasExtractedText: boolean;
  extractedChars: number;
  jobApplicationId: number | null;
  createdAt: string;
};

type AppRef = { id: number; company: string; role: string };

const KIND_LABELS: Record<string, string> = {
  application: "Ansøgning",
  cv: "CV",
  job_posting: "Job-opslag",
  reference: "Reference",
  other: "Andet",
};

const KIND_COLORS: Record<string, string> = {
  application: "bg-[rgba(74,144,226,0.15)] text-[var(--accent-bright)]",
  cv: "bg-[rgba(74,222,128,0.15)] text-[var(--success)]",
  job_posting: "bg-[rgba(167,139,250,0.15)] text-[#a78bfa]",
  reference: "bg-[rgba(251,191,36,0.15)] text-[var(--warning)]",
  other: "bg-[rgba(160,174,192,0.15)] text-[var(--mid)]",
};

const ACCEPT =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,text/html,.html,.md";

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function extractableHint(mime: string): string | null {
  if (
    mime === "application/pdf" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/html" ||
    mime === "text/plain" ||
    mime === "text/markdown"
  ) {
    return "Teksten ekstraheres ved upload og bliver søgbar af AI.";
  }
  return null;
}

export function DocumentsClient({
  initialDocuments,
  applications,
}: {
  initialDocuments: Doc[];
  applications: AppRef[];
}) {
  const [docs, setDocs] = useState(initialDocuments);
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.title, d.filename, KIND_LABELS[d.kind] ?? d.kind]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [docs, query]);

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <h1 className="font-serif text-[32px] font-medium leading-none text-ink">
          Dokumenter
        </h1>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Upload className="size-4" />
          Upload dokument
        </button>
      </header>

      <p className="mb-4 text-[13px] text-mid">
        Saml dine CV&apos;er, ansøgninger og job-opslag her. AI får automatisk
        adgang til de tekstbaserede filer (PDF, DOCX, HTML, TXT) — så når du
        skriver fremtidige ansøgninger med Claude kan den trække på din historik.
      </p>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="size-4 text-light" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg i titler, filnavne, kategorier..."
          className="!w-full !border-0 !bg-transparent !p-0 !text-[14px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="cursor-pointer text-dim hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-6 py-12 text-center text-[13px] italic text-light">
          {docs.length === 0
            ? "Ingen dokumenter endnu — upload dit første."
            : "Ingen match."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              applications={applications}
              onDelete={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          applications={applications}
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => {
            setDocs((prev) => [doc, ...prev]);
            setShowUpload(false);
          }}
        />
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  applications,
  onDelete,
}: {
  doc: Doc;
  applications: AppRef[];
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  const linkedApp = doc.jobApplicationId
    ? applications.find((a) => a.id === doc.jobApplicationId)
    : null;

  function remove() {
    if (!confirm(`Slet "${doc.title}"?`)) return;
    start(async () => {
      const res = await deleteDocument(doc.id);
      if (res.ok) onDelete();
    });
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
      <FileText className="mt-0.5 size-5 shrink-0 text-light" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <a
            href={doc.blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink hover:text-accent-bright"
          >
            {doc.title}
          </a>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.3px] ${
              KIND_COLORS[doc.kind] ?? KIND_COLORS.other
            }`}
          >
            {KIND_LABELS[doc.kind] ?? doc.kind}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-light">
          <span>{doc.filename}</span>
          <span>{fmtSize(doc.sizeBytes)}</span>
          {doc.hasExtractedText && (
            <span className="text-success">
              ✓ {doc.extractedChars.toLocaleString("da-DK")} tegn ekstraheret
            </span>
          )}
          {linkedApp && (
            <span className="text-accent-bright">
              → {linkedApp.company}
              {linkedApp.role && ` · ${linkedApp.role}`}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="shrink-0 cursor-pointer text-dim hover:text-danger"
        title="Slet"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function UploadDialog({
  applications,
  onClose,
  onUploaded,
}: {
  applications: AppRef[];
  onClose: () => void;
  onUploaded: (doc: Doc) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<string>("application");
  const [title, setTitle] = useState("");
  const [jobAppId, setJobAppId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onPick(f: File | undefined) {
    setFile(f ?? null);
    if (f && !title) {
      const stem = f.name.replace(/\.[^.]+$/, "");
      setTitle(stem);
    }
  }

  function submit() {
    if (!file) {
      setError("Vælg en fil");
      return;
    }
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fd.append("title", title.trim() || file.name);
    if (jobAppId) fd.append("jobApplicationId", jobAppId);

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
        blobUrl: res.url,
        mimeType: file.type,
        sizeBytes: file.size,
        hasExtractedText: res.extractedChars > 0,
        extractedChars: res.extractedChars,
        jobApplicationId: jobAppId ? Number(jobAppId) : null,
        createdAt: new Date().toISOString(),
      });
    });
  }

  const hint = file ? extractableHint(file.type) : null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-[20px] text-accent-bright">
            Upload dokument
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
              Fil
            </label>
            <input
              type="file"
              accept={ACCEPT}
              onChange={(e) => onPick(e.target.files?.[0])}
              className="!text-[13px] file:mr-3 file:cursor-pointer file:rounded-[3px] file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
            />
            {file && (
              <p className="mt-1 text-[11px] text-light">
                {file.name} · {fmtSize(file.size)}
              </p>
            )}
            {hint && (
              <p className="mt-1 text-[11px] italic text-success">{hint}</p>
            )}
            {file && !hint && (
              <p className="mt-1 text-[11px] italic text-light">
                Bevares som er — ingen tekst-ekstraktion for denne filtype.
              </p>
            )}
            <p className="mt-1 text-[11px] text-dim">
              Understøttede formater: PDF, DOCX, HTML, MD, TXT (max 10 MB)
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-mid">
              Type
            </label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="application">Ansøgning</option>
              <option value="cv">CV</option>
              <option value="job_posting">Job-opslag</option>
              <option value="reference">Reference</option>
              <option value="other">Andet</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-mid">
              Titel
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="fx 'CV version 4' eller 'Ansøgning TDC frontend'"
            />
          </div>

          {applications.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-mid">
                Tilknyt job (valgfrit)
              </label>
              <select
                value={jobAppId}
                onChange={(e) => setJobAppId(e.target.value)}
              >
                <option value="">— Ingen —</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company}
                    {a.role && ` · ${a.role}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !file}
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
