"use client";

import { useEffect } from "react";

const DARK = "#0a0f1a";
const LIGHT = "#f5f3ee";
const META_ID = "dynamic-theme-color";

function currentColor(): string {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light") return LIGHT;
  if (explicit === "dark") return DARK;
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? LIGHT
    : DARK;
}

function getOrCreateMeta(): HTMLMetaElement {
  let meta = document.getElementById(META_ID) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.id = META_ID;
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  return meta;
}

function applyMeta() {
  const meta = getOrCreateMeta();
  meta.setAttribute("content", currentColor());
}

export function ThemeColorSync() {
  useEffect(() => {
    applyMeta();
    const observer = new MutationObserver(() => applyMeta());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyMeta();
    mq.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", onChange);
      // Vi lader meta-elementet blive i DOM'en — at fjerne det her under
      // strict-mode dobbelt-mount eller route-change kan kollidere med React's
      // egen head-reconciliation og resultere i en removeChild-fejl.
    };
  }, []);
  return null;
}
