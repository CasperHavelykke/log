"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, FileText, Search, Trash2, Upload, X } from "lucide-react";
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
  application: "bg-[var(--accent-bg)] text-accent",
  cv: "bg-[rgba(74,222,128,0.15)] text-[var(--success)]",
  job_posting: "bg-[rgba(167,139,250,0.15)] text-[#a78bfa]",
  reference: "bg-[var(--warning-soft)] text-[var(--warning)]",
  other: "bg-bg-subtle text-mid",
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
    <div className="mx-auto max-w-[880px] px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-hair pb-5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Dokumenter
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            {docs.length === 0
              ? "Ingen dokumenter endnu"
              : `${docs.length} fil${docs.length === 1 ? "" : "er"} i arkivet`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Upload className="size-3.5" strokeWidth={2.5} />
          Upload dokument
        </button>
      </header>

      <p className="mb-4 text-[13px] text-mid">
        Saml dine CV&apos;er, ansøgninger og job-opslag her. AI får automatisk
        adgang til de tekstbaserede filer (PDF, DOCX, HTML, TXT) — så når du
        skriver fremtidige ansøgninger med Claude kan den trække på din historik.
      </p>

      <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-bg-elevated px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
        <Search className="size-4 text-light" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg i titler, filnavne, kategorier…"
          className="!w-full !rounded-none !border-0 !bg-transparent !p-0 !text-[14px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="inline-flex cursor-pointer items-center rounded-[6px] p-1 text-dim hover:bg-bg hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
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
    <div className="flex items-start gap-3 rounded-[10px] bg-bg-elevated p-3 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] sm:p-4">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-bg)] text-accent">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <a
            href={`/api/files/document/${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink hover:text-accent"
          >
            {doc.title}
          </a>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.3px] ${
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
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="size-3" />
              {doc.extractedChars.toLocaleString("da-DK")} tegn ekstraheret
            </span>
          )}
          {linkedApp && (
            <span className="text-accent">
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
        className="inline-flex shrink-0 cursor-pointer items-center rounded-[6px] p-1.5 text-dim hover:bg-bg hover:text-danger disabled:opacity-50"
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
              Nyt dokument
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              Upload dokument
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
              Fil
            </label>
            <input
              type="file"
              accept={ACCEPT}
              onChange={(e) => onPick(e.target.files?.[0])}
              className="!w-auto !text-[13px] text-mid file:mr-3 file:cursor-pointer file:rounded-[8px] file:border-0 file:bg-bg-subtle file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
            />
            {file && (
              <p className="mt-1 text-[11px] text-light">
                {file.name} · {fmtSize(file.size)}
              </p>
            )}
            {hint && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] italic text-success">
                <Check className="size-3" />
                {hint}
              </p>
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
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Type
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            >
              <option value="application">Ansøgning</option>
              <option value="cv">CV</option>
              <option value="job_posting">Job-opslag</option>
              <option value="reference">Reference</option>
              <option value="other">Andet</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Titel
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="fx 'CV version 4' eller 'Ansøgning TDC frontend'"
              className="!rounded-[8px] !border-hair !bg-bg-subtle"
            />
          </div>

          {applications.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
                Tilknyt job <span className="normal-case tracking-normal text-dim">— valgfrit</span>
              </label>
              <select
                value={jobAppId}
                onChange={(e) => setJobAppId(e.target.value)}
                className="!rounded-[8px] !border-hair !bg-bg-subtle"
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
              disabled={pending || !file}
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
