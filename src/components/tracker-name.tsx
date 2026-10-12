"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";

// Navnet på en skjult tracker vises som "Skjult", indtil man trykker på
// det — bevidst en neutral placeholder frem for sløret tekst (korte navne
// er stadig læselige gennem et blur). Afsløringen er lokal for denne
// forekomst; sidens "Vis private" kan tvinge den via forceReveal.
// Renderes som <span role=button>, så den også kan stå inde i et <Link>
// uden knap-i-link-HTML; preventDefault stopper linkets navigation.
export function TrackerName({
  name,
  hidden,
  forceReveal = false,
  className = "",
}: {
  name: string;
  hidden: boolean;
  forceReveal?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  if (!hidden || revealed || forceReveal) return <>{name}</>;
  return (
    <span
      role="button"
      tabIndex={0}
      title="Skjult — tryk for at vise navnet"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setRevealed(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          setRevealed(true);
        }
      }}
      className={`inline-flex cursor-pointer items-center gap-1 text-light ${className}`}
    >
      <EyeOff className="size-[0.85em]" />
      Skjult
    </span>
  );
}
