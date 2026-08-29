"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Link2Off, X } from "lucide-react";

// Genbrugelig dialog til delelinks (enkelt opskrift + hele samlingen).
// Tokenet ejes af kalderen; dialogen bygger URL'en fra window.location.
export function ShareDialog({
  label,
  title,
  description,
  token,
  pathForToken,
  onToggle,
  onClose,
}: {
  label: string;
  title: string;
  description: string;
  token: string | null;
  pathForToken: (token: string) => string;
  onToggle: (enabled: boolean) => Promise<{ ok: boolean; token?: string | null }>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const url =
    token !== null && typeof window !== "undefined"
      ? `${window.location.origin}${pathForToken(token)}`
      : null;

  function toggle(enabled: boolean) {
    start(async () => {
      await onToggle(enabled);
      setCopied(false);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard kan være blokeret (http, gamle browsere) — feltet kan
      // stadig markeres manuelt.
    }
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
              {label}
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              {title}
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

        <p className="text-[13px] text-mid">{description}</p>

        {url ? (
          <>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[12px]"
              />
              <button
                type="button"
                onClick={copy}
                title="Kopiér link"
                className={`inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-2 text-[12px] font-medium ${
                  copied
                    ? "bg-[var(--success-soft)] text-success"
                    : "bg-accent text-white hover:bg-accent-bright"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" strokeWidth={2.5} />
                    Kopieret
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Kopiér
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-[11px] italic text-light">
              Alle med linket kan se indholdet — men kun læse, ikke ændre.
            </p>
            <div className="mt-5 border-t border-hair pt-4">
              <button
                type="button"
                onClick={() => toggle(false)}
                disabled={pending}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-2 text-[12px] text-dim hover:bg-bg hover:text-danger disabled:opacity-50"
              >
                <Link2Off className="size-3.5" />
                {pending ? "Stopper…" : "Stop deling"}
              </button>
              <p className="mt-1 text-[11px] text-dim">
                Linket holder øjeblikkeligt op med at virke. Deler du igen
                senere, får du et nyt link.
              </p>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => toggle(true)}
            disabled={pending}
            className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            <Link2 className="size-4" />
            {pending ? "Opretter…" : "Opret delelink"}
          </button>
        )}
      </div>
    </div>
  );
}
