"use client";

import { useRouter } from "next/navigation";
import { CounterScreen } from "./counter-screen";
import type { ActiveSessionPayload } from "./actions";

const ESCAPE_COOKIE = "drink-counter-escape";

export function CounterWrapper({
  initial,
}: {
  initial: ActiveSessionPayload;
}) {
  const router = useRouter();

  function escape() {
    // Cookie uden expiry = session cookie (clears når browser lukkes).
    document.cookie = `${ESCAPE_COOKIE}=1; path=/; SameSite=Lax`;
    router.refresh();
  }

  return <CounterScreen initial={initial} onEscape={escape} />;
}

export function FloatingCounterBanner({
  totalUnits,
}: {
  totalUnits: number;
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
      <span className="font-semibold">{totalUnits}</span>
      <span>genstande · tilbage til tæller →</span>
    </button>
  );
}
