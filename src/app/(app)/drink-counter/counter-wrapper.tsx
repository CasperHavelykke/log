"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { CounterScreen } from "./counter-screen";
import { startSession } from "./actions";
import { fmtUnitsX10, type ActiveSessionPayload } from "./constants";

const ESCAPE_COOKIE = "drink-counter-escape";

export function CounterWrapper({
  initial,
  counterMode = false,
}: {
  initial: ActiveSessionPayload | null;
  counterMode?: boolean;
}) {
  const router = useRouter();

  function escape() {
    // Cookie uden expiry = session cookie (clears når browser lukkes).
    document.cookie = `${ESCAPE_COOKIE}=1; path=/; SameSite=Lax`;
    router.refresh();
  }

  if (initial === null) {
    // Genstandstæller-tilstand uden aktiv session: minimal startskærm.
    return <CounterStartScreen onEscape={escape} />;
  }
  return (
    <CounterScreen initial={initial} counterMode={counterMode} onEscape={escape} />
  );
}

function CounterStartScreen({ onEscape }: { onEscape: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function begin() {
    setError(null);
    start(async () => {
      const res = await startSession();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 flex h-[100vh] flex-col bg-bg text-ink"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <header className="flex shrink-0 items-center justify-end px-5 pt-6">
        <button
          type="button"
          onClick={onEscape}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hair-strong px-3 py-1.5 text-[12px] text-mid hover:border-accent hover:text-accent"
        >
          <ArrowLeft className="size-3.5" />
          Til appen
        </button>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <h1 className="mb-2 font-serif text-[34px] text-ink">
          Genstandstæller
        </h1>
        <p className="mb-10 max-w-[300px] text-center text-[13px] text-mid">
          Tæl aftenens genstande og hold øje med tempoet — indikatoren siger
          til, når det er tid til vand, pause eller hjem.
        </p>
        <button
          type="button"
          onClick={begin}
          disabled={pending}
          className="flex w-full max-w-[300px] cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-accent px-6 py-5 text-[18px] font-semibold text-white shadow-[0_8px_24px_rgba(110,169,242,0.35)] transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Plus className="size-5" />
          )}
          Start session
        </button>
        {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
      </main>
    </div>
  );
}

// null = ingen aktiv session (genstandstæller-tilstand): knappen fører
// tilbage til tællerens startskærm.
export function FloatingCounterBanner({
  totalUnitsX10,
}: {
  totalUnitsX10: number | null;
}) {
  const router = useRouter();

  function returnToCounter() {
    document.cookie = `${ESCAPE_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={returnToCounter}
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
      }}
      className="fixed right-4 z-[60] inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(110,169,242,0.4)] transition active:scale-95 md:!bottom-6"
    >
      {totalUnitsX10 === null ? (
        <span>Genstandstæller →</span>
      ) : (
        <>
          <span className="font-semibold">{fmtUnitsX10(totalUnitsX10)}</span>
          <span>genstande · tilbage til tæller →</span>
        </>
      )}
    </button>
  );
}
