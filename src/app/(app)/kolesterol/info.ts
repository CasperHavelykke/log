// Tekster til info-dialogen pr. felt: hvad tallet er, hvorfor det betyder
// noget for kolesterol, og hvor det kommer fra. Kilderne er europæiske:
// ESC/EAS-retningslinjerne (2019) og Patienthåndbogen på sundhed.dk
// (skrevet af Hjerteforeningens diætist). Tal og grænser er taget derfra —
// ret ikke uden at tjekke kilden.

export type InfoField =
  | "saturatedFat"
  | "fiber"
  | "kcal"
  | "carbs"
  | "fat"
  | "protein"
  | "alcohol";

export type Source = { label: string; url: string };

const ESC_EAS: Source = {
  label: "ESC/EAS-retningslinjer for dyslipidæmi, 2019 (European Heart Journal)",
  url: "https://academic.oup.com/eurheartj/article/41/1/111/5556353",
};
const SUNDHED_KOSTRAAD: Source = {
  label: "Kostråd ved forhøjet kolesterol — Patienthåndbogen, sundhed.dk",
  url: "https://www.sundhed.dk/borger/patienthaandbogen/hjerte-og-blodkar/sygdomme/kostraad/kostraad-ved-forhoejet-kolesterolniveau/",
};
const SUNDHED_KOST_TRAENING: Source = {
  label: "Højt kolesterol — hjælper kostændringer og træning? — Patienthåndbogen, sundhed.dk",
  url: "https://www.sundhed.dk/borger/patienthaandbogen/hormoner-og-stofskifte/sygdomme/kolesterolforstyrrelser/hoejt-kolesterol-hjaelper-kostaendringer-og-traening/",
};

export type FieldInfo = {
  title: string;
  unit: string;
  // Hvad tallet er, og hvordan bjælken skal læses. Korte sætninger.
  what: string;
  // Hvorfor det betyder noget for kolesterol. Fra kilderne.
  why: string;
  sources: Source[];
};

export const FIELD_INFO: Record<InfoField, FieldInfo> = {
  saturatedFat: {
    title: "Mættet fedt",
    unit: "g",
    what: "Mættet fedt er en del af dagens fedt, ikke et tillæg. Det tæller derfor ikke ekstra i kalorierne. Bjælken har et loft: holder du dig under det, er du i det grønne.",
    why: "Mættet fedt er den enkelte kostfaktor, der hæver LDL-kolesterolet mest. De europæiske retningslinjer anbefaler under 10 % af dagens energi fra mættet fedt, og under 7 % ved forhøjet kolesterol. Ved 2.000 kcal om dagen svarer 7 % til omkring 15 g. Det findes især i smør, fede mejeriprodukter, fedt kød og pålæg. Byt det ud med umættet fedt fra olie, nødder og fisk, så falder LDL.",
    sources: [ESC_EAS, SUNDHED_KOSTRAAD],
  },
  fiber: {
    title: "Fibre",
    unit: "g",
    what: "Kostfibre er kulhydrater, men står for sig selv, som på varedeklarationen. De tæller ikke med i kulhydrat-tallet. Bjælken har et minimum: når du op på det, er du i det grønne.",
    why: "Kostfibre, især fra fuldkorn og havre, sænker LDL-kolesterolet. Retningslinjerne anbefaler 25–40 g fibre om dagen, heraf 7–13 g opløselige fibre fra fx havre, byg, bønner og frugt. Hjerteforeningen anbefaler mindst 90 g fuldkorn om dagen.",
    sources: [ESC_EAS, SUNDHED_KOSTRAAD],
  },
  kcal: {
    title: "Kalorier",
    unit: "kcal",
    what: "Dagens kalorier regnes af kulhydrat, protein, fedt og fibre, plus 100 kcal pr. genstand. Tallet vises først, når alle tre makroer er logget. Zonen er dit vedligehold: det interval, hvor vægten holder sig.",
    why: "Vægt og kalorier hænger sammen. Vægttab ved overvægt sænker LDL lidt, omkring 0,2 mmol/l pr. 10 kg, og triglycerider mere. Et vægttab på 5–10 % forbedrer kolesteroltallet. Kalorier er altså et middel, ikke målet i sig selv: inden for vedligehold holder du vægten, lidt under taber du dig langsomt.",
    sources: [ESC_EAS, SUNDHED_KOST_TRAENING],
  },
  carbs: {
    title: "Kulhydrat",
    unit: "g",
    what: "Kulhydrat uden fibre, som på varedeklarationen. Fibre står for sig selv.",
    why: "Mængden af kulhydrat påvirker ikke LDL ret meget, men meget sukker og hurtige kulhydrater hæver triglycerider. Vælg fuldkorn frem for hvidt brød, slik og sukkerholdige drikke.",
    sources: [ESC_EAS, SUNDHED_KOST_TRAENING],
  },
  fat: {
    title: "Fedt",
    unit: "g",
    what: "Det samlede fedt for dagen. Mættet fedt er en del af det og har sin egen bjælke.",
    why: "Det er typen af fedt, der tæller, ikke mængden. Umættet fedt fra planteolier, nødder og fisk sænker LDL, når det erstatter mættet fedt. Hold derfor øje med 'Mættet fedt' frem for det samlede fedt.",
    sources: [SUNDHED_KOST_TRAENING, ESC_EAS],
  },
  protein: {
    title: "Protein",
    unit: "g",
    what: "Dagens protein. Bjælken har typisk et minimum.",
    why: "Protein påvirker ikke kolesterolet direkte, men det mætter og hjælper med at holde musklerne ved vægttab. Vælg magre kilder: fisk, fjerkræ, bælgfrugter og magre mejeriprodukter, så følger der mindre mættet fedt med.",
    sources: [SUNDHED_KOSTRAAD],
  },
  alcohol: {
    title: "Genstande",
    unit: "",
    what: "Antal genstande i dag. Hver genstand tæller omkring 100 kcal oveni dagens kalorier, også på dage uden anden logning.",
    why: "Alkohol hæver især triglycerider, og et stort indtag øger risikoen for hjerte-kar-sygdom. Retningslinjerne siger højst 1 genstand om dagen, og helt pause fra alkohol, hvis triglyceriderne er forhøjede.",
    sources: [ESC_EAS, SUNDHED_KOST_TRAENING],
  },
};
