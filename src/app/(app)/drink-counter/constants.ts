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
  // Roisin mode (udvidet knapsæt — se ROISIN_* i counter-screen):
  | "roisin_øl_alm"
  | "roisin_øl_stor"
  | "roisin_øl_alm_stærk"
  | "roisin_øl_stor_stærk"
  | "roisin_drink_mild"
  | "roisin_drink_mellem"
  | "roisin_drink_stærk"
  | "roisin_drink_mild_dbl"
  | "roisin_drink_mellem_dbl"
  | "roisin_drink_stærk_dbl"
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
  // Roisin: øl 33/50 cl i alm (~4,6 %) og stærk (~7 %); drinks i tre
  // styrker (~2/4/6 cl spiritus), dbl = ekstra 2 cl 40 % (+0,5).
  roisin_øl_alm: 10,
  roisin_øl_stor: 15,
  roisin_øl_alm_stærk: 15,
  roisin_øl_stor_stærk: 23,
  roisin_drink_mild: 5,
  roisin_drink_mellem: 10,
  roisin_drink_stærk: 15,
  roisin_drink_mild_dbl: 10,
  roisin_drink_mellem_dbl: 15,
  roisin_drink_stærk_dbl: 20,
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
  roisin_øl_alm: 130,
  roisin_øl_stor: 200,
  roisin_øl_alm_stærk: 180,
  roisin_øl_stor_stærk: 270,
  roisin_drink_mild: 120,
  roisin_drink_mellem: 180,
  roisin_drink_stærk: 240,
  roisin_drink_mild_dbl: 165,
  roisin_drink_mellem_dbl: 225,
  roisin_drink_stærk_dbl: 285,
  genstand: 100,
  shot: 50,
  stærk_shot: 70,
};

export const KIND_LABEL: Record<DrinkKind, string> = {
  øl: "Øl",
  drink: "Drink",
  mildt_shot_2: "Alm. shot 2 cl",
  mildt_shot_4: "Alm. shot 4 cl",
  stærkt_shot_2: "Stærkt shot 2 cl",
  stærkt_shot_4: "Stærkt shot 4 cl",
  roisin_øl_alm: "Alm. øl 33 cl",
  roisin_øl_stor: "Stor øl 50 cl",
  roisin_øl_alm_stærk: "Stærk øl 33 cl",
  roisin_øl_stor_stærk: "Stærk øl 50 cl",
  roisin_drink_mild: "Drink mild",
  roisin_drink_mellem: "Drink mellem",
  roisin_drink_stærk: "Drink stærk",
  roisin_drink_mild_dbl: "Drink mild · dobbelt",
  roisin_drink_mellem_dbl: "Drink mellem · dobbelt",
  roisin_drink_stærk_dbl: "Drink stærk · dobbelt",
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
