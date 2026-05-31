/**
 * Parser for Garmin Connect's "Søvn"-CSV-eksport (dansk locale).
 *
 * Eksempel-format:
 *   Søvnscore 1 dag,
 *   Dato,2026-05-25
 *   Søvnvarighed,8t 55m
 *   Søvnscore,79
 *   Kvalitet,Nogenlunde
 *   ...
 */

export type ParsedGarminSleep = {
  date: string; // YYYY-MM-DD
  durationMin: number | null;
  score: number | null;
  qualityLabel: string | null;
  deepMin: number | null;
  lightMin: number | null;
  remMin: number | null;
  awakeMin: number | null;
  avgStress: number | null;
  breathingVariation: string | null;
  restlessMoments: number | null;
  avgHeartRate: number | null;
  restingHeartRate: number | null;
  bodyBatteryChange: number | null;
  avgSpO2: number | null;
  lowestSpO2: number | null;
  avgBreathingX10: number | null;
  lowestBreathingX10: number | null;
  hrvMs: number | null;
  hrv7dStatus: string | null;
};

function normalizeKey(k: string): string {
  return k
    .toLowerCase()
    .replace(/₂/g, "2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseDuration(s: string | undefined): number | null {
  if (!s) return null;
  const h = s.match(/(\d+)\s*t/);
  const m = s.match(/(\d+)\s*m/);
  if (!h && !m) return null;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function parseInt2(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function parseFloatX10(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+([.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 10) : null;
}

function pick(map: Map<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = map.get(k);
    if (v !== undefined) return v;
  }
  return undefined;
}

export function parseGarminSleepCsv(text: string): ParsedGarminSleep | null {
  // Strip BOM
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);
  const map = new Map<string, string>();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(",");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!value) continue; // sektionsheaders har tom værdi
    if (!key) continue;
    map.set(normalizeKey(key), value);
  }

  const date = parseDate(map.get("dato"));
  if (!date) return null;

  return {
    date,
    durationMin: parseDuration(pick(map, "søvnvarighed")),
    score: parseInt2(pick(map, "søvnscore")),
    qualityLabel: pick(map, "kvalitet") ?? null,
    deepMin: parseDuration(pick(map, "varighed af dyb søvn")),
    lightMin: parseDuration(pick(map, "varighed af let søvn")),
    remMin: parseDuration(pick(map, "varighed af rem")),
    awakeMin: parseDuration(pick(map, "tid vågen")),
    avgStress: parseInt2(pick(map, "stress gennemsnit", "gennemsnitlig stress")),
    breathingVariation: pick(map, "vejrtrækningsvariationer") ?? null,
    restlessMoments: parseInt2(pick(map, "urolige øjeblikke")),
    avgHeartRate: parseInt2(pick(map, "gennemsnitlig nattepuls", "gennemsnitlig puls")),
    restingHeartRate: parseInt2(pick(map, "hvilepuls")),
    bodyBatteryChange: parseInt2(pick(map, "ændring af body battery")),
    avgSpO2: parseInt2(pick(map, "gennemsnitlig spo2")),
    lowestSpO2: parseInt2(pick(map, "laveste spo2")),
    avgBreathingX10: parseFloatX10(pick(map, "gennemsnitlig vejrtrækning")),
    lowestBreathingX10: parseFloatX10(pick(map, "laveste vejrtrækning")),
    hrvMs: parseInt2(pick(map, "gns natlig hrv", "gennemsnitlig natlig hrv")),
    hrv7dStatus: pick(map, "7d gns hrv", "7-dages gns hrv") ?? null,
  };
}
