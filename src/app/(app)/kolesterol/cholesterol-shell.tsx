"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartColumn, Settings, SlidersHorizontal } from "lucide-react";
import type { CholesterolData } from "./data";
import { TodayView } from "./today-view";
import { HistoryView } from "./history-view";

export const CHOLESTEROL_ESCAPE_COOKIE = "kolesterol-escape";

type Tab = "today" | "history";

// Kolesterol-tilstand: to faner, ingen ruter. Erstatter hele app-layoutet
// (samme greb som genstandstælleren). Tandhjulet er flugtvejen til den
// normale app — det er dér AI-connectoren kobles på.
export function CholesterolShell({ data }: { data: CholesterolData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");
  const [confirmLeave, setConfirmLeave] = useState(false);

  function escape() {
    // Session-cookie: ryddes når browseren lukkes. Tandhjulet lander
    // direkte på Indstillinger — det er dér connectoren kobles på.
    document.cookie = `${CHOLESTEROL_ESCAPE_COOKIE}=1; path=/; SameSite=Lax`;
    router.push("/settings");
    router.refresh();
  }

  return (
    <div
      className="flex h-[100vh] flex-col bg-bg text-ink"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <main className="mx-auto w-full max-w-[560px] flex-1 overflow-y-auto px-4 pb-6 pt-5">
        {tab === "today" ? (
          <TodayView data={data} onEscape={() => setConfirmLeave(true)} />
        ) : (
          <HistoryView data={data} onEscape={() => setConfirmLeave(true)} />
        )}
      </main>

      {confirmLeave && (
        <LeaveDialog onCancel={() => setConfirmLeave(false)} onConfirm={escape} />
      )}

      <nav
        className="shrink-0 border-t border-hair bg-bg-elevated"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Visning"
      >
        <div className="mx-auto flex max-w-[560px]">
          <TabButton
            active={tab === "today"}
            onClick={() => setTab("today")}
            icon={<SlidersHorizontal className="size-5" />}
            label="I dag"
          />
          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
            icon={<ChartColumn className="size-5" />}
            label="Historik"
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[12px] transition-colors ${
        active ? "font-semibold text-ink" : "text-light hover:text-mid"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function EscapeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Indstillinger"
      title="Indstillinger"
      className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-light hover:bg-bg-subtle hover:text-ink"
    >
      <Settings className="size-5" />
    </button>
  );
}

// Tandhjulet forlader visningen. Sig det tydeligt, og sig hvordan man
// kommer tilbage — ellers tror man, appen er gået i stykker.
function LeaveDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        className="w-full max-w-[360px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-dialog-title" className="font-serif text-[20px] leading-none text-ink">
          Forlad visningen?
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-mid">
          Du går nu til appens indstillinger. Vil du tilbage hertil, så tryk
          på den blå knap <strong className="font-semibold text-ink">Dagens indtag →</strong>{" "}
          nederst i hjørnet.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="min-h-11 cursor-pointer rounded-[8px] px-4 text-[14px] text-mid hover:text-ink"
          >
            Bliv her
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 cursor-pointer rounded-[8px] bg-accent px-5 text-[14px] font-medium text-white"
          >
            Gå til indstillinger
          </button>
        </div>
      </div>
    </div>
  );
}
