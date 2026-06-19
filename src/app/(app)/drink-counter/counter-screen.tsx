"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import {
  addDrink,
  endSession,
  removeDrink,
  type ActiveSessionPayload,
  type DrinkKind,
} from "./actions";

const KIND_LABEL: Record<DrinkKind, string> = {
  genstand: "Genstand",
  shot: "Shot",
  stærk_shot: "Stærk shot",
};

export function CounterScreen({
  initial,
  onEscape,
}: {
  initial: ActiveSessionPayload;
  onEscape: () => void;
}) {
  const [session, setSession] = useState<ActiveSessionPayload>(initial);
  const [pending, startTx] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function press(kind: DrinkKind) {
    startTx(async () => {
      const res = await addDrink({ kind });
      if (!res.ok) return;
      // Optimistic-style: tilføj log lokalt med temp id
      const units = kind === "stærk_shot" ? 2 : 1;
      setSession((s) => ({
        ...s,
        totalUnits: s.totalUnits + units,
        logs: [
          ...s.logs,
          {
            id: Math.max(0, ...s.logs.map((l) => l.id)) + 1,
            unitCount: units,
            kind,
            occurredAt: new Date().toISOString(),
          },
        ],
      }));
    });
  }

  function undo(logId: number) {
    startTx(async () => {
      const res = await removeDrink({ logId });
      if (!res.ok) return;
      setSession((s) => {
        const log = s.logs.find((l) => l.id === logId);
        return {
          ...s,
          totalUnits: s.totalUnits - (log?.unitCount ?? 0),
          logs: s.logs.filter((l) => l.id !== logId),
        };
      });
    });
  }

  function confirmEnd() {
    if (
      !confirm(
        `Afslut session? Du har talt ${session.totalUnits} genstande. ` +
          "Tællingen lægges på din alkohol-log for dagen.",
      )
    ) {
      return;
    }
    setEnding(true);
    startTx(async () => {
      await endSession();
      // Layout vil re-evaluere og vise normal app.
      window.location.href = "/today";
    });
  }

  const elapsed = formatElapsed(now - new Date(session.startedAt).getTime());

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg text-ink">
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.6px] text-light">
          Aktiv · {elapsed}
        </span>
        <button
          type="button"
          onClick={onEscape}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hair-strong px-3 py-1.5 text-[12px] text-mid hover:border-accent hover:text-accent"
        >
          <ArrowLeft className="size-3.5" />
          Til appen
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-6">
        <div className="mb-8 flex flex-col items-center">
          <div
            className="font-serif text-[140px] leading-none text-accent"
            style={{ letterSpacing: "-3px" }}
          >
            {session.totalUnits}
          </div>
          <div className="mt-2 text-[13px] text-mid">
            {session.totalUnits === 1 ? "genstand" : "genstande"}
          </div>
        </div>

        <div className="w-full max-w-[420px] space-y-3">
          <button
            type="button"
            onClick={() => press("genstand")}
            disabled={pending || ending}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-accent px-6 py-5 text-[18px] font-semibold text-white shadow-[0_8px_24px_rgba(110,169,242,0.35)] transition active:scale-[0.98] disabled:opacity-60"
          >
            <Plus className="size-5" />
            Genstand
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => press("shot")}
              disabled={pending || ending}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] bg-bg-elevated px-4 py-3.5 text-[14px] font-medium text-ink transition active:scale-[0.98] disabled:opacity-60"
            >
              <Plus className="size-4" />
              Shot
              <span className="text-[11px] text-light">(1)</span>
            </button>
            <button
              type="button"
              onClick={() => press("stærk_shot")}
              disabled={pending || ending}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] bg-bg-elevated px-4 py-3.5 text-[14px] font-medium text-ink transition active:scale-[0.98] disabled:opacity-60"
            >
              <Plus className="size-4" />
              Stærk shot
              <span className="text-[11px] text-light">(2)</span>
            </button>
          </div>
        </div>
      </main>

      <section className="border-t border-hair px-5 py-4">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-light">
              Indtag
            </span>
            {pending && (
              <Loader2 className="size-3 animate-spin text-light" />
            )}
          </div>
          {session.logs.length === 0 ? (
            <p className="text-[12px] italic text-dim">
              Ingen indtag endnu. Tryk på en knap ovenfor.
            </p>
          ) : (
            <ul className="max-h-[26vh] space-y-1.5 overflow-y-auto">
              {[...session.logs].reverse().map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 rounded-[8px] bg-bg-elevated px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-ink">
                    {KIND_LABEL[l.kind]}
                  </span>
                  <span className="text-accent">
                    {l.unitCount}
                    {l.unitCount === 1 ? " g." : " g."}
                  </span>
                  <span className="ml-auto text-[11px] text-light">
                    {formatTime(l.occurredAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => undo(l.id)}
                    disabled={pending}
                    className="cursor-pointer text-dim hover:text-danger"
                    title="Fortryd"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="border-t border-hair px-5 py-4">
        <button
          type="button"
          onClick={confirmEnd}
          disabled={ending}
          className="mx-auto block cursor-pointer text-[12px] text-light hover:text-danger disabled:opacity-50"
        >
          {ending ? "Afslutter…" : "Afslut session"}
        </button>
      </footer>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}t ${m}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
