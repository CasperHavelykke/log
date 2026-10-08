"use client";

import { EyeOff } from "lucide-react";

// Private billeder vises slørede overalt, indtil man aktivt trykker på dem.
// Det er ren visning — et værn mod blikke over skulderen, når appen står
// åben. Adgangskontrollen (hvem der overhovedet kan hente filen) sidder
// uændret i /api/files og er bruger-scopet. Afsløringen huskes kun i
// komponentens levetid: genindlæs siden, og alt er sløret igen.

// Lægges på <img> mens billedet er skjult.
export const PRIVATE_BLUR_CLASS = "blur-2xl";

// Rent visuelt lag over et sløret billede — klik håndteres af forælderen,
// så det kan betyde "vis" i gitteret og i viseren uden knap-i-knap-HTML.
export function PrivateOverlay({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/35 text-white"
    >
      <EyeOff className={compact ? "size-5" : "size-7"} />
      {!compact && (
        <span className="text-[11px] font-medium tracking-[0.3px]">
          Privat · tryk for at vise
        </span>
      )}
    </span>
  );
}
