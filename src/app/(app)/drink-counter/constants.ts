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
  logs: Array<{
    id: number;
    unitsX10: number;
    kind: DrinkKind;
    occurredAt: string;
  }>;
};
