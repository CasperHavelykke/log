import type { CustomParameterKind } from "@/db/schema";

export type ParameterPreset = {
  key: string;
  name: string;
  kind: CustomParameterKind;
  description: string;
};

// Helbreds-præsets — tidligere hardcoded i /today og /helbred.
// Brugere kan tilføje dem som custom parameters fra /settings.
// 'key' bruges som intern identifier; 'name' er det display-navn der oprettes.
export const HEALTH_PRESETS: ParameterPreset[] = [
  {
    key: "headache",
    name: "Hovedpine",
    kind: "bool_scale_10",
    description: "Skete det? Hvis ja: hvor slemt (1-10)",
  },
  {
    key: "constipation",
    name: "Forstoppelse",
    kind: "bool_scale_5",
    description: "Skete det? Hvis ja: hvor smertefuldt (1-5)",
  },
  {
    key: "iskias",
    name: "Iskias-smerte",
    kind: "scale_5",
    description: "Vurder fra 1 til 5",
  },
  {
    key: "derm",
    name: "Skæleksem",
    kind: "scale_5",
    description: "Vurder fra 1 til 5",
  },
  {
    key: "breathing",
    name: "Vejrtrækningsbesvær",
    kind: "scale_5",
    description: "Vurder fra 1 til 5",
  },
];
