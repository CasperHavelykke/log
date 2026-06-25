"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, X } from "lucide-react";
import { deleteFast } from "../today/fast-actions";

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}t ${String(m).padStart(2, "0")}m`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "i dag";
  if (days === 1) return "i går";
  if (days === 2) return "i forgårs";
  if (days < 7) return `for ${days} dage siden`;
  return `${d.getDate()}. ${["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][d.getMonth()]}`;
}

export function FasteRow({
  id,
  startedAt,
  endedAt,
  mins,
}: {
  id: number;
  startedAt: string;
  endedAt: string;
  mins: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const qualified = mins >= 16 * 60;

  function onDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Slet denne faste-registrering?")) return;
    start(async () => {
      await deleteFast(id);
      router.refresh();
    });
  }

  return (
    <div
      className={`group flex items-center gap-2.5 rounded-[10px] bg-bg-elevated px-3 py-2.5 text-[13px] shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] md:rounded-[8px] md:bg-bg md:py-2 md:shadow-none ${pending ? "opacity-50" : ""}`}
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          qualified
            ? "bg-[var(--success-soft)] text-success"
            : "bg-[var(--warning-soft)] text-warning"
        }`}
      >
        {qualified ? (
          <Check className="size-3.5" strokeWidth={2.5} />
        ) : (
          <Clock className="size-3.5" />
        )}
      </span>
      <span
        className={`font-semibold ${qualified ? "text-ink" : "text-warning"}`}
      >
        {fmtDuration(mins)}
      </span>
      <span className="ml-auto text-[12px] text-mid">
        {fmtRelative(startedAt)} · {fmtTime(startedAt)} → {fmtTime(endedAt)}
      </span>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        title="Slet denne faste"
        aria-label="Slet faste"
        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-dim transition-colors hover:bg-bg hover:text-danger md:hover:bg-bg-elevated"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
