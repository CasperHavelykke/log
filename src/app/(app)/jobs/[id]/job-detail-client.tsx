"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteJobApplication,
  updateJobApplication,
} from "../../today/actions";
import { ApplicationDocuments } from "@/components/application-documents";
import { danishLongDate } from "@/lib/date";
import type { JobStatus } from "@/db/schema";

type Status = JobStatus;

type AppDoc = {
  id: number;
  title: string;
  kind: string;
  filename: string;
  mimeType: string;
};

type App = {
  id: number;
  company: string;
  role: string;
  status: Status;
  files: string;
  url: string;
  contactPerson: string;
  notes: string;
  applicationText: string;
  sentAt: string;
  updatedAt: string;
};

type Event = {
  id: number;
  status: Status;
  occurredAt: string;
  note: string | null;
};

const STATUS_LABELS: Record<Status, string> = {
  sent: "Sendt",
  no_response: "Intet svar",
  replied: "Svar",
  interview: "Samtale",
  offer: "Tilbud",
  rejected: "Afvist",
  withdrawn: "Trukket",
};

const STATUS_ORDER: Status[] = [
  "sent",
  "no_response",
  "replied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

const STATUS_PILL_CLASSES: Record<Status, string> = {
  sent: "bg-accent-bg text-accent",
  no_response: "bg-[rgba(160,174,192,0.15)] text-mid",
  replied: "bg-[var(--warning-soft)] text-warning",
  interview: "bg-[var(--success-soft)] text-success",
  offer: "bg-[rgba(74,222,128,0.22)] text-success",
  rejected: "bg-[rgba(248,113,113,0.12)] text-danger",
  withdrawn: "bg-[rgba(160,174,192,0.15)] text-mid",
};

const STATUS_DOT_BG: Record<Status, string> = {
  sent: "bg-accent",
  no_response: "bg-mid",
  replied: "bg-warning",
  interview: "bg-success",
  offer: "bg-success",
  rejected: "bg-danger",
  withdrawn: "bg-mid",
};

export function JobDetailClient({
  app: initial,
  events: initialEvents,
  documents: initialDocs,
  unattached: initialUnattached,
}: {
  app: App;
  events: Event[];
  documents: AppDoc[];
  unattached: AppDoc[];
}) {
  const router = useRouter();
  const [app, setApp] = useState<App>(initial);
  const [draft, setDraft] = useState<App>(initial);
  const [editing, setEditing] = useState(false);
  const [events] = useState<Event[]>(initialEvents);
  const [documents, setDocuments] = useState<AppDoc[]>(initialDocs);
  const [unattached, setUnattached] = useState<AppDoc[]>(initialUnattached);
  const [saving, startSave] = useTransition();

  function patch<K extends keyof App>(field: K, value: App[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function startEditing() {
    setDraft(app);
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(app);
    setEditing(false);
  }

  function saveDraft() {
    startSave(async () => {
      const res = await updateJobApplication({
        id: app.id,
        company: draft.company,
        role: draft.role || null,
        status: draft.status,
        files: draft.files || null,
        url: draft.url || null,
        contactPerson: draft.contactPerson || null,
        notes: draft.notes || null,
        sentAt: draft.sentAt || null,
      });
      if (res.ok !== false) {
        setApp(draft);
        setEditing(false);
        router.refresh();
      }
    });
  }

  async function onDelete() {
    if (!confirm(`Slet ansøgning til ${app.company}?`)) return;
    await deleteJobApplication(app.id);
    router.push("/jobs");
  }

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8">
      {/* Top: back + actions */}
      <div className="mb-5 flex items-center justify-between">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-[13px] text-mid hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Tilbage til ansøgninger
        </Link>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] text-mid hover:bg-bg-elevated hover:text-ink disabled:opacity-50"
              >
                <X className="size-3.5" />
                Annullér
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
              >
                <Check className="size-3.5" strokeWidth={2.5} />
                {saving ? "Gemmer…" : "Gem"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] text-dim hover:bg-bg-elevated hover:text-danger"
              >
                <Trash2 className="size-3.5" />
                Slet
              </button>
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-bg-elevated px-3.5 py-1.5 text-[12px] text-mid hover:bg-bg-subtle hover:text-ink"
              >
                <Pencil className="size-3.5" />
                Rediger
              </button>
            </>
          )}
        </div>
      </div>

      {/* Page header */}
      <header className="mb-5 border-b border-hair pb-5">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] ${STATUS_PILL_CLASSES[app.status]}`}
          >
            <span className={`size-1.5 rounded-full ${STATUS_DOT_BG[app.status]}`} />
            {STATUS_LABELS[app.status]}
          </span>
          {app.sentAt && (
            <span className="text-[11px] uppercase tracking-[0.3px] text-light">
              Sendt {danishLongDate(app.sentAt)}
            </span>
          )}
        </div>
        <h1 className="font-serif text-[28px] font-medium leading-tight text-ink sm:text-[34px]">
          {app.company || "Uden firma"}
        </h1>
        {app.role && (
          <p className="mt-1 text-[14px] text-mid">{app.role}</p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.5fr_1fr] md:items-start">
        {/* Left: details */}
        <div className="space-y-5">
          <section className="rounded-[10px] bg-bg-elevated p-5 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
            <h2 className="mb-3 border-b border-hair pb-2 font-serif text-[16px] text-accent">
              Grundoplysninger
            </h2>
            {editing ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Firma">
                  <input
                    type="text"
                    value={draft.company}
                    onChange={(e) => patch("company", e.target.value)}
                  />
                </Field>
                <Field label="Stilling">
                  <input
                    type="text"
                    value={draft.role}
                    onChange={(e) => patch("role", e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={draft.status}
                    onChange={(e) => patch("status", e.target.value as Status)}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sendt-dato">
                  <input
                    type="date"
                    value={draft.sentAt}
                    onChange={(e) => patch("sentAt", e.target.value)}
                  />
                </Field>
                <Field label="URL til stillingsopslag" full>
                  <input
                    type="url"
                    value={draft.url}
                    onChange={(e) => patch("url", e.target.value)}
                    placeholder="https://..."
                  />
                </Field>
                <Field label="Kontaktperson" full>
                  <input
                    type="text"
                    value={draft.contactPerson}
                    onChange={(e) => patch("contactPerson", e.target.value)}
                    placeholder="Navn + evt. titel"
                  />
                </Field>
              </div>
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <InfoRow label="Firma" value={app.company} />
                <InfoRow label="Stilling" value={app.role || "—"} />
                <InfoRow label="Status" value={STATUS_LABELS[app.status]} />
                <InfoRow
                  label="Sendt-dato"
                  value={app.sentAt ? danishLongDate(app.sentAt) : "—"}
                />
                <InfoRow
                  label="URL til stillingsopslag"
                  full
                  value={
                    app.url ? (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-accent hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        <span className="truncate">{app.url}</span>
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <InfoRow
                  label="Kontaktperson"
                  full
                  value={app.contactPerson || "—"}
                />
              </dl>
            )}
          </section>

          <section className="rounded-[10px] bg-bg-elevated p-5 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
            <h2 className="mb-3 border-b border-hair pb-2 font-serif text-[16px] text-accent">
              Noter
            </h2>
            {editing ? (
              <textarea
                value={draft.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Indtryk fra samtale, opfølgning, andet…"
                rows={6}
                className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[14px]"
              />
            ) : app.notes ? (
              <p className="whitespace-pre-wrap text-[13px] text-mid">
                {app.notes}
              </p>
            ) : (
              <p className="text-[12px] italic text-light">Ingen noter</p>
            )}
          </section>
        </div>

        {/* Right: documents + timeline */}
        <div className="space-y-5">
          <section className="rounded-[10px] bg-bg-elevated p-5 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
            <h2 className="mb-3 border-b border-hair pb-2 font-serif text-[16px] text-accent">
              Dokumenter
            </h2>
            <ApplicationDocuments
              applicationId={app.id}
              attached={documents}
              availableForAttach={unattached}
              onChange={(next) => {
                const added = next.filter((d) => !documents.some((x) => x.id === d.id));
                const removed = documents.filter((d) => !next.some((x) => x.id === d.id));
                setDocuments(next);
                setUnattached((prev) => {
                  const filtered = prev.filter((d) => !added.some((x) => x.id === d.id));
                  return [...filtered, ...removed];
                });
              }}
            />
          </section>

          <section className="rounded-[10px] bg-bg-elevated p-5 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)]">
            <h2 className="mb-3 border-b border-hair pb-2 font-serif text-[16px] text-accent">
              Tidslinje
            </h2>
            {events.length === 0 ? (
              <p className="text-[12px] italic text-light">Ingen events endnu</p>
            ) : (
              <ul className="space-y-2.5">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${STATUS_DOT_BG[e.status]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 text-[12px]">
                        <span className="font-medium text-ink">
                          {STATUS_LABELS[e.status]}
                        </span>
                        <span className="text-light">
                          {danishLongDate(e.occurredAt)}
                        </span>
                      </div>
                      {e.note && (
                        <div className="mt-0.5 text-[11px] italic text-mid">
                          {e.note}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="mt-4 text-right text-[11px] italic text-light">
        Sidst opdateret {new Date(app.updatedAt).toLocaleString("da-DK")}
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-ink">{value}</dd>
    </div>
  );
}
