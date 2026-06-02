"use client";

import { useState } from "react";
import {
  ExternalLink as ExternalLinkIcon,
  File,
  Folder,
  Paperclip,
} from "lucide-react";

function isAbsolutePath(s: string): boolean {
  return (
    /^[a-zA-Z]:[\\/]/.test(s) ||
    s.startsWith("\\\\") ||
    s.startsWith("//") ||
    s.startsWith("/")
  );
}

function looksLikeFolder(path: string): boolean {
  if (path.endsWith("\\") || path.endsWith("/")) return true;
  const last = path.split(/[\\/]/).pop() ?? "";
  return !last.includes(".");
}

async function openPath(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Netværksfejl" };
  }
}

export function FileLinks({ value }: { value: string }) {
  const [error, setError] = useState<string | null>(null);

  if (!value) return null;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {parts.map((part, i) => {
        const clickable = isAbsolutePath(part);
        const folder = clickable && looksLikeFolder(part);
        const displayName = part.split(/[\\/]/).filter(Boolean).pop() ?? part;
        return clickable ? (
          <button
            key={i}
            type="button"
            onClick={async () => {
              setError(null);
              const res = await openPath(part);
              if (!res.ok) setError(res.error ?? "Kunne ikke åbne");
            }}
            title={part}
            className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-[3px] border border-border-light bg-bg px-2 py-0.5 text-accent-bright hover:border-accent-dim hover:bg-accent-bg"
          >
            {folder ? (
              <Folder className="size-3 shrink-0" />
            ) : (
              <File className="size-3 shrink-0" />
            )}
            <span className="truncate">{displayName}</span>
          </button>
        ) : (
          <span
            key={i}
            className="inline-flex max-w-full items-center gap-1 rounded-[3px] border border-border-light bg-bg px-2 py-0.5 text-dim"
            title={part}
          >
            <Paperclip className="size-3 shrink-0" />
            <span className="truncate">{part}</span>
          </span>
        );
      })}
      {error && (
        <span className="ml-1 text-[11px] text-danger" title={error}>
          ⚠ {error}
        </span>
      )}
    </div>
  );
}

function hostnameOf(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export function ExternalLink({ href }: { href: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex max-w-full items-center gap-1 text-[12px] text-accent-bright hover:underline"
      title={href}
    >
      <ExternalLinkIcon className="size-3 shrink-0" />
      <span className="truncate">{hostnameOf(href)}</span>
    </a>
  );
}
