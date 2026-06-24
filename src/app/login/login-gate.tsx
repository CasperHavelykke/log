"use client";

import { useEffect, useState } from "react";

type Env = "loading" | "desktop-or-pwa" | "mobile-browser";

function detectEnv(): Env {
  if (typeof window === "undefined") return "loading";

  const isPWA =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  if (isPWA) return "desktop-or-pwa";

  const ua = window.navigator.userAgent;
  const isMobile =
    /iPad|iPhone|iPod|Android/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return isMobile ? "mobile-browser" : "desktop-or-pwa";
}

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [env, setEnv] = useState<Env>("loading");
  const [show, setShow] = useState(false);

  useEffect(() => {
    setEnv(detectEnv());
  }, []);

  // PWA/desktop: vis formen direkte
  if (env === "desktop-or-pwa") return <>{children}</>;

  // Loading SSR / hydration: vis intet endnu for at undgå flash
  if (env === "loading") return null;

  // Mobile browser: vis knap der reveal'er formen
  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="w-full rounded-[10px] bg-bg-elevated px-4 py-3 text-[13px] text-mid hover:bg-bg-subtle hover:text-ink"
      >
        Login på browser
      </button>
    );
  }

  return <>{children}</>;
}
