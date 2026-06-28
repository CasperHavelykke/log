// Konstanter og typer der deles mellem server-actions og andre moduler.
// Ligger udenfor actions.ts fordi Next 16's "use server"-filer kun må
// eksportere async funktioner — ikke typer eller objekter.

export type DrinkKind = "genstand" | "shot" | "stærk_shot";

export const KIND_UNITS: Record<DrinkKind, number> = {
  genstand: 1,
  shot: 1,
  stærk_shot: 2,
};

// Estimerede kalorier per indtag.
//   genstand: en standard drink (øl/vin/glas spiritus, ~80-120 kcal)
//   shot:     2 cl spiritus ~30-40 %
//   stærk_shot: 2 cl spiritus 40 %+
export const KIND_KCAL: Record<DrinkKind, number> = {
  genstand: 100,
  shot: 50,
  stærk_shot: 70,
};

export type ActiveSessionPayload = {
  id: number;
  sessionDate: string;
  startedAt: string;
  totalUnits: number;
  logs: Array<{
    id: number;
    unitCount: number;
    kind: DrinkKind;
    occurredAt: string;
  }>;
};
