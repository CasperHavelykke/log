// Konstanter og typer der deles mellem server-actions og andre moduler.
// Ligger udenfor actions.ts fordi Next 16's "use server"-filer kun må
// eksportere async funktioner — ikke typer eller objekter.

// Seks knapper (2026-09-20) — genstande i TIENDEDELE, så små shots tæller
// ærligt (den gamle model overtalte et 2 cl 40%-shot som 2 genstande;
// reelt er det ~0,5). De tre gamle kinds beholdes som læselige labels for
// historiske rækker og gamle backups.
export type DrinkKind =
  | "øl"
  | "drink"
  | "mildt_shot_2"
  | "mildt_shot_4"
  | "stærkt_shot_2"
  | "stærkt_shot_4"
  // Legacy (før 0039):
  | "genstand"
  | "shot"
  | "stærk_shot";

// Genstande ×10. Regnestykke: 1 genstand = 12 g ren alkohol.
//   øl 33 cl ~4,6 %            → ~12 g   = 1,0
//   drink m. ~4 cl spiritus    → ~12,6 g = 1,0
//   mildt shot 2 cl ~17 %      → ~2,7 g  = 0,2
//   mildt shot 4 cl ~17 %      → ~5,4 g  = 0,4
//   stærkt shot 2 cl 40 %+     → ~6,3 g  = 0,5
//   stærkt shot 4 cl 40 %+     → ~12,6 g = 1,0
export const KIND_UNITS_X10: Record<DrinkKind, number> = {
  øl: 10,
  drink: 10,
  mildt_shot_2: 2,
  mildt_shot_4: 4,
  stærkt_shot_2: 5,
  stærkt_shot_4: 10,
  genstand: 10,
  shot: 10,
  stærk_shot: 20,
};

// Estimerede kalorier per indtag (drinken trækker op pga. sukker).
export const KIND_KCAL: Record<DrinkKind, number> = {
  øl: 130,
  drink: 180,
  mildt_shot_2: 30,
  mildt_shot_4: 60,
  stærkt_shot_2: 45,
  stærkt_shot_4: 90,
  genstand: 100,
  shot: 50,
  stærk_shot: 70,
};

export const KIND_LABEL: Record<DrinkKind, string> = {
  øl: "Øl",
  drink: "Drink",
  mildt_shot_2: "Mildt shot 2 cl",
  mildt_shot_4: "Mildt shot 4 cl",
  stærkt_shot_2: "Stærkt shot 2 cl",
  stærkt_shot_4: "Stærkt shot 4 cl",
  genstand: "Genstand",
  shot: "Shot",
  stærk_shot: "Stærk shot",
};

// De kinds der har knapper i tælleren (legacy-kinds er kun visning).
export const ACTIVE_KINDS = [
  "øl",
  "drink",
  "mildt_shot_2",
  "mildt_shot_4",
  "stærkt_shot_2",
  "stærkt_shot_4",
] as const satisfies readonly DrinkKind[];

// 1 dansk genstand = 12g ren alkohol ≈ 84 kcal ren ethanol. Med typisk
// sukker/kulhydrater i øl/vin/drinks lander det omkring 100 kcal pr. enhed.
// Bruges hvor dags-total beregnes fra day_entries.alcoholUnits (som bumpes
// af genstandstælleren og kan sættes manuelt).
export const KCAL_PER_ALCOHOL_UNIT = 100;

export function fmtUnitsX10(x10: number): string {
  const value = x10 / 10;
  const rounded = Math.round(value * 10) / 10;
  return (Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1))
    .replace(".", ",");
}

export type ActiveSessionPayload = {
  id: number;
  sessionDate: string;
  startedAt: string;
  totalUnitsX10: number;
  // Seneste vejning fra dagsdata (kg ×10) — kalibrerer forbrændingen.
  bodyWeightX10: number | null;
  logs: Array<{
    id: number;
    unitsX10: number;
    kind: DrinkKind;
    occurredAt: string;
  }>;
};

// --- "Aktive genstande" — tempo-indikatoren -------------------------------
// Kroppen forbrænder ca. 0,1 g alkohol pr. kg kropsvægt pr. time
// (tommelfingerregel, ikke en promillemåler — promille ville kræve køn/
// højde/kropsvæske via Widmark). Vi simulerer sessionens indtag minus
// forbrænding og får ét tal: genstande der er aktive i kroppen lige nu.
// Det fanger både mængde OG tempo — og falder af sig selv under pauser.
const BURN_G_PER_KG_PER_HOUR = 0.1;
const GRAMS_PER_UNIT = 12;
export const DEFAULT_BODY_WEIGHT_KG = 80;

export function burnUnitsX10PerHour(weightKg: number): number {
  return (BURN_G_PER_KG_PER_HOUR * weightKg * 10) / GRAMS_PER_UNIT;
}

export function activeUnitsX10(
  logs: Array<{ unitsX10: number; occurredAt: string }>,
  nowMs: number,
  weightKg: number,
): number {
  const burnPerMs = burnUnitsX10PerHour(weightKg) / 3_600_000;
  const sorted = [...logs].sort(
    (a, b) => a.occurredAt.localeCompare(b.occurredAt),
  );
  let level = 0;
  let prevMs: number | null = null;
  for (const l of sorted) {
    const t = new Date(l.occurredAt).getTime();
    if (prevMs !== null) level = Math.max(0, level - burnPerMs * (t - prevMs));
    level += l.unitsX10;
    prevMs = t;
  }
  if (prevMs !== null) {
    level = Math.max(0, level - burnPerMs * (nowMs - prevMs));
  }
  return level;
}

export type PaceLevel = {
  key: "ro" | "gul" | "orange" | "rød" | "hjem";
  label: string;
  // Farver som CSS-værdier (orange findes ikke som app-token).
  color: string;
  softBg: string;
  // Maksimalt niveau: banneret går i massiv alarm-visning.
  alarm?: boolean;
};

// Tærskler i aktive genstande (×10).
export function paceLevel(activeX10: number): PaceLevel {
  if (activeX10 < 20) {
    return {
      key: "ro",
      label: "Roligt tempo",
      color: "var(--accent)",
      softBg: "var(--accent-bg)",
    };
  }
  if (activeX10 < 35) {
    return {
      key: "gul",
      label: "Mærkbart",
      color: "var(--warning)",
      softBg: "var(--warning-soft)",
    };
  }
  if (activeX10 < 50) {
    return {
      key: "orange",
      label: "Overvej en pause",
      color: "#fb923c",
      softBg: "rgba(251, 146, 60, 0.14)",
    };
  }
  if (activeX10 < 70) {
    return {
      key: "rød",
      label: "Kroppen er langt bagud — vand og pause",
      color: "var(--danger)",
      softBg: "var(--danger-soft)",
    };
  }
  // ~7 aktive genstande ≈ 1,4-1,6 promille ved 80-85 kg: dømmekraften er
  // reelt væk og blackout-zonen begynder. Sidste påmindelse.
  return {
    key: "hjem",
    label: "TAG HJEM",
    color: "#ffffff",
    softBg: "var(--danger)",
    alarm: true,
  };
}
