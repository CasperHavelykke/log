"use client";

import { useEffect, useState } from "react";

// Privatlivs-slør: efter N minutters inaktivitet lægges et blur-overlay
// over hele appen; et bevidst klik/tastetryk fjerner det (musebevægelse
// gør ikke — den nulstiller kun timeren). Indstillingen er PER ENHED
// (localStorage) — telefonen og desktoppen kan have hver sin. Det er et
// værn mod nysgerrige blikke, ikke en lås: indholdet ligger stadig i
// browseren, og man er fortsat logget ind.

export const IDLE_BLUR_KEY = "loggen.idleBlurMinutes";
export const IDLE_BLUR_EVENT = "idle-blur-changed";

export function readIdleBlurMinutes(): number | null {
  try {
    const raw = localStorage.getItem(IDLE_BLUR_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function IdleBlur() {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [blurred, setBlurred] = useState(false);

  // Indstillingen læses ved mount og når settings-siden ændrer den.
  useEffect(() => {
    setMinutes(readIdleBlurMinutes());
    const onChanged = () => setMinutes(readIdleBlurMinutes());
    window.addEventListener(IDLE_BLUR_EVENT, onChanged);
    return () => window.removeEventListener(IDLE_BLUR_EVENT, onChanged);
  }, []);

  useEffect(() => {
    if (minutes === null) {
      setBlurred(false);
      return;
    }
    const ms = minutes * 60_000;
    let timer: number | undefined;
    let lastActivity = Date.now();

    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBlurred(true), ms);
    };
    const onActivity = () => {
      lastActivity = Date.now();
      arm();
    };
    // iOS/Safari fryser timere i baggrunden — ved tilbagevenden tjekkes
    // den reelle inaktive tid, så sløret også rammer efter lang tid væk.
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastActivity >= ms
      ) {
        setBlurred(true);
      }
    };

    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", onActivity, opts);
    window.addEventListener("pointermove", onActivity, opts);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, opts);
    window.addEventListener("scroll", onActivity, opts);
    document.addEventListener("visibilitychange", onVisible);
    arm();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("scroll", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [minutes]);

  // Tastetryk fjerner sløret (klik håndteres af selve overlay-knappen).
  useEffect(() => {
    if (!blurred) return;
    const onKey = () => setBlurred(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blurred]);

  if (!blurred) return null;
  // Rent slør uden tekst/ikon — et klik (eller tastetryk) fjerner det.
  return (
    <button
      type="button"
      onClick={() => setBlurred(false)}
      aria-label="Skærmen er sløret efter inaktivitet — klik for at vise"
      className="fixed inset-0 z-[100] w-full cursor-pointer bg-bg/60 backdrop-blur-2xl"
    />
  );
}
