"use client";

import { useRouter } from "next/navigation";
import { CHOLESTEROL_ESCAPE_COOKIE } from "./cholesterol-shell";

// Vises i den normale app når kolesterol-tilstanden er slået til, men
// brugeren har trykket "Til appen". Ét tryk = tilbage til visningen.
export function CholesterolReturnBanner() {
  const router = useRouter();

  function back() {
    document.cookie = `${CHOLESTEROL_ESCAPE_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={back}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
      className="fixed right-4 z-[60] inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(110,169,242,0.4)] transition active:scale-95 md:!bottom-6"
    >
      Dagens indtag →
    </button>
  );
}
