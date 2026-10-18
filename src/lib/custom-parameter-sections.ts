// Hvor en egen parameter vises: under en af de faste sektioner på /today
// og /helbred (faste felter først, egne bagefter) — eller, uden valg,
// i "Mine parametre" som hidtil. Klient-sikker (ingen drizzle-import).

export const CUSTOM_SECTIONS = [
  "sleep",
  "mood",
  "body",
  "nutrition",
  "activity",
] as const;
export type CustomSection = (typeof CUSTOM_SECTIONS)[number];

export const SECTION_LABELS: Record<CustomSection, string> = {
  sleep: "Søvn",
  mood: "Stemning",
  body: "Krop",
  nutrition: "Ernæring",
  activity: "Aktivitet",
};

export function isCustomSection(v: unknown): v is CustomSection {
  return typeof v === "string" && (CUSTOM_SECTIONS as readonly string[]).includes(v);
}

export type BySection<T> = Record<CustomSection | "none", T[]>;

// Grupperer i visningsrækkefølge; ukendt/tomt → "none" (Mine parametre).
export function groupBySection<T extends { section: string | null }>(
  items: T[],
): BySection<T> {
  const out: BySection<T> = {
    sleep: [],
    mood: [],
    body: [],
    nutrition: [],
    activity: [],
    none: [],
  };
  for (const it of items) {
    if (isCustomSection(it.section)) out[it.section].push(it);
    else out.none.push(it);
  }
  return out;
}
