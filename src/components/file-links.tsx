"use client";

import { useState } from "react";

function isAbsolutePath(s: string): boolean {
  return (
    /^[a-zA-Z]:[\\/]/.test(s) || // Windows: C:\ or C:/
    s.startsWith("\\\\") || // UNC \\server\share
    s.startsWith("//") || // POSIX network
    s.startsWith("/") // POSIX absolute
  );
}

function looksLikeFolder(path: string): boolean {
  if (path.endsWith("\\") || path.endsWith("/")) return true;
  // No extension on last segment → probably folder
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
      <span className="text-dim">📎</span>
      {parts.map((part, i) => {
        const clickable = isAbsolutePath(part);
        const folder = clickable && looksLikeFolder(part);
        const displayName = part.split(/[\\/]/).filter(Boolean).pop() ?? part;
        return (
          <span key={i} className="flex items-center gap-1">
            {clickable ? (
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  const res = await openPath(part);
                  if (!res.ok) setError(res.error ?? "Kunne ikke åbne");
                }}
                title={part}
                className="cursor-pointer rounded border border-transparent px-1 py-0.5 text-accent-bright underline-offset-2 hover:bg-accent-bg hover:underline"
              >
                {folder ? "📁" : "📄"} {displayName}
              </button>
            ) : (
              <span className="text-dim">{part}</span>
            )}
            {i < parts.length - 1 && <span className="text-dim">,</span>}
          </span>
        );
      })}
      {error && (
        <span className="ml-2 text-danger" title={error}>
          ⚠ {error}
        </span>
      )}
    </div>
  );
}

export function ExternalLink({ href }: { href: string }) {
  if (!href) return null;
  const display = href.length > 60 ? href.slice(0, 57) + "..." : href;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-[12px] text-accent-bright underline-offset-2 hover:underline"
      title={href}
    >
      🔗 {display}
    </a>
  );
}
