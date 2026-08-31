import { KCAL_PER_ALCOHOL_UNIT } from "@/app/(app)/drink-counter/constants";

// Fælles kalorie-beregning for /today, /helbred og /statistik.
// Reglerne:
//   - Makro-kcal kræver at alle tre makroer er logget (ellers ville en dag
//     med kun protein=80 ligne en 320 kcal-dag).
//   - Kostfibre er VALGFRI og separate fra kulhydrater (EU-deklarationer
//     angiver kulhydrat ekskl. fibre). Logget fiber bidrager med 2 kcal/g.
//   - Alkohol tæller altid med i totalen: alcoholUnits × 100 kcal.
export function dayKcal(input: {
  carbsG: number | null | undefined;
  proteinG: number | null | undefined;
  fatG: number | null | undefined;
  fiberG?: number | null | undefined;
  alcoholUnits: number | null | undefined;
}): {
  macroKcal: number | null;
  drinkKcal: number;
  totalKcal: number | null;
} {
  const { carbsG, proteinG, fatG, fiberG, alcoholUnits } = input;
  const macroKcal =
    carbsG != null && proteinG != null && fatG != null
      ? carbsG * 4 + proteinG * 4 + fatG * 9 + (fiberG ?? 0) * 2
      : null;
  const drinkKcal = (alcoholUnits ?? 0) * KCAL_PER_ALCOHOL_UNIT;
  const totalKcal =
    macroKcal !== null ? macroKcal + drinkKcal : drinkKcal > 0 ? drinkKcal : null;
  return { macroKcal, drinkKcal, totalKcal };
}

// Meta-tekst til Ernæring-sektionens header — samme ordlyd på /today og
// /helbred.
export function kcalMetaText(k: ReturnType<typeof dayKcal>): string | undefined {
  if (k.totalKcal === null) return undefined;
  if (k.drinkKcal > 0 && k.macroKcal !== null) {
    return `${k.totalKcal} kcal · inkl. ${k.drinkKcal} fra drikkevarer`;
  }
  if (k.drinkKcal > 0 && k.macroKcal === null) {
    return `${k.drinkKcal} kcal fra drikkevarer`;
  }
  return `${k.totalKcal} kcal`;
}
