/**
 * Søvn-hjælpere: konvertering mellem Garmins søvnscore (0-100) og vores
 * kvalitetsskala (1-4), samt "effektive" værdier hvor Garmin har prioritet
 * over manuelt indtastede tal.
 *
 * Garmin-inddeling:
 *   <60 → Dårlig (1)
 *   60-79 → Rimelig (2)
 *   80-89 → God (3)
 *   90-100 → Fremragende (4)
 */

// "Fremragende" får blød bindestreg (­) så den brækker pænt i smalle celler.
export const SLEEP_QUALITY_LABELS = [
  "Dårlig",
  "Rimelig",
  "God",
  "Frem­ragende",
] as const;

export function garminScoreToQuality(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  if (score < 60) return 1;
  if (score < 80) return 2;
  if (score < 90) return 3;
  return 4;
}

export function qualityLabel(q: number | null | undefined): string | null {
  if (q === null || q === undefined) return null;
  if (q < 1 || q > 4) return null;
  return SLEEP_QUALITY_LABELS[q - 1];
}

/** Resolves to effective sleep hours × 10. Garmin's measured duration wins
 * if present; otherwise falls back to the manual value on the day entry. */
export function effectiveSleepHoursX10(
  manualX10: number | null | undefined,
  garminDurationMin: number | null | undefined,
): number | null {
  if (garminDurationMin !== null && garminDurationMin !== undefined) {
    return Math.round(garminDurationMin / 6); // minutter → timer × 10
  }
  return manualX10 ?? null;
}

/** Resolves to effective sleep quality (1-4). Garmin's score-derived
 * quality wins if present; otherwise falls back to manual. */
export function effectiveSleepQuality(
  manual: number | null | undefined,
  garminScore: number | null | undefined,
): number | null {
  const fromGarmin = garminScoreToQuality(garminScore);
  if (fromGarmin !== null) return fromGarmin;
  return manual ?? null;
}
