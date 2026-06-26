"use client";

import { useEffect, useState } from "react";
import { Share } from "lucide-react";

type Env =
  | "loading"
  | "pwa"
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-samsung"
  | "android-other"
  | "desktop";

function detectEnv(): Env {
  if (typeof window === "undefined") return "loading";

  const isPWA =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  if (isPWA) return "pwa";

  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    // CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge, OPiOS = Opera
    if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return "ios-other";
    return "ios-safari";
  }

  if (isAndroid) {
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/EdgA|OPR\//.test(ua)) return "android-other";
    if (/Chrome/.test(ua)) return "android-chrome";
    return "android-other";
  }

  return "desktop";
}

export function InstallPrompt() {
  const [env, setEnv] = useState<Env>("loading");

  useEffect(() => {
    setEnv(detectEnv());
  }, []);

  if (env === "loading" || env === "pwa" || env === "desktop") return null;

  return (
    <div className="mb-8 rounded-[12px] border border-[var(--accent-soft-strong)] bg-bg-elevated p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3">
        <h2 className="font-serif text-[20px] font-medium text-ink">
          Velkommen til Loggen
        </h2>
        <p className="mt-1 text-[13px] text-mid">
          Loggen er en database for dit liv, som kan tilkobles til din
          foretrukne AI for nem logning og opfølgning uden at åbne appen.
        </p>
      </div>

      {env === "ios-safari" && <IosSafariInstructions />}
      {env === "ios-other" && <IosOtherInstructions />}
      {env === "android-chrome" && <AndroidChromeInstructions />}
      {env === "android-samsung" && <AndroidSamsungInstructions />}
      {env === "android-other" && <AndroidOtherInstructions />}
    </div>
  );
}

function StepHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.5px] text-accent">
      {children}
    </div>
  );
}

function Step({
  number,
  icon,
  children,
}: {
  number: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-1">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[11px] font-semibold text-accent">
        {number}
      </span>
      <div className="flex flex-1 items-center gap-2 text-[13px] text-ink">
        <span>{children}</span>
        {icon && <span className="inline-flex shrink-0 text-mid">{icon}</span>}
      </div>
    </li>
  );
}

function IosSafariInstructions() {
  return (
    <>
      <StepHeader>Føj til hjemmeskærm</StepHeader>
      <ol className="space-y-1">
        <Step number={1} icon={<Share className="size-4" />}>
          Tryk på <strong className="font-medium">Del</strong>-ikonet nederst i
          Safari
        </Step>
        <Step number={2}>
          Rul ned og vælg{" "}
          <strong className="font-medium">&ldquo;Føj til hjemmeskærm&rdquo;</strong>
        </Step>
        <Step number={3}>
          Tryk <strong className="font-medium">&ldquo;Tilføj&rdquo;</strong> i
          øverste højre hjørne
        </Step>
      </ol>
    </>
  );
}

function IosOtherInstructions() {
  return (
    <>
      <StepHeader>Åbn i Safari for at installere</StepHeader>
      <p className="text-[13px] text-mid">
        På iPhone og iPad kan du kun føje Loggen til hjemmeskærmen via{" "}
        <strong className="font-medium text-ink">Safari</strong>. Åbn{" "}
        <strong className="font-medium text-ink">loggen.app</strong> i Safari og
        følg vejledningen dér.
      </p>
    </>
  );
}

function AndroidChromeInstructions() {
  return (
    <>
      <StepHeader>Føj til hjemmeskærm</StepHeader>
      <ol className="space-y-1">
        <Step number={1}>
          Tryk på{" "}
          <strong className="font-medium">&ldquo;Føj til startskærm&rdquo;</strong>
          -ikonet (skærm med pil ned) øverst til højre i Chrome
        </Step>
        <Step number={2}>
          Vælg <strong className="font-medium">&ldquo;Installer&rdquo;</strong>
          {" "}(ikke &ldquo;Opret genvej&rdquo;)
        </Step>
        <Step number={3}>
          Bekræft med{" "}
          <strong className="font-medium">&ldquo;Installer&rdquo;</strong> igen
        </Step>
      </ol>
    </>
  );
}

function AndroidSamsungInstructions() {
  return (
    <>
      <StepHeader>Føj til hjemmeskærm</StepHeader>
      <ol className="space-y-1">
        <Step number={1}>
          Tryk på <strong className="font-medium">install-ikonet</strong>{" "}
          (firkant med pil ned) i adresselinjen
        </Step>
        <Step number={2}>
          Vælg <strong className="font-medium">&ldquo;Tilføj&rdquo;</strong> i
          dialogen
        </Step>
      </ol>
    </>
  );
}

function AndroidOtherInstructions() {
  return (
    <>
      <StepHeader>Åbn i Chrome for at installere</StepHeader>
      <p className="text-[13px] text-mid">
        På Android virker installation bedst via{" "}
        <strong className="font-medium text-ink">Chrome</strong>. Åbn{" "}
        <strong className="font-medium text-ink">loggen.app</strong> i Chrome og
        følg vejledningen dér.
      </p>
    </>
  );
}
