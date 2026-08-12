// Lempelig parser til trænings-brødtekst. Én linje ad gangen:
//
//   "Til slut:"                          → heading (ender med ':')
//   "Chin-ups — 4×2 fra failure"         → exercise (indeholder tankestreg-
//   "KB press, én arm — 4×6-8 @ 16 kg"     separator; sæt×reps + vægt
//                                          udtrækkes NÅR mønstret er der)
//   "Superset, 90 sek pause"             → note (alt andet)
//
// Intet format er obligatorisk — linjer der ikke matcher noget mønster
// vises bare som noter. Samme princip som opskrifternes ingrediens-parser.

export type WorkoutLine =
  | { type: "heading"; text: string }
  | {
      type: "exercise";
      name: string;
      detail: string;
      sets: number | null;
      reps: string | null;
      weight: string | null;
    }
  | { type: "note"; text: string };

// Separator mellem øvelsesnavn og detalje: em-dash, en-dash eller " - ".
// Bindestreg UDEN luft (fx "Chin-ups") splitter ikke.
const EXERCISE_SEP = /\s+[—–]\s+|\s+-\s+/;

// "4×6-8", "3 x 10-12", "2×30-45 sek", "4 × 2 fra failure"
const SETS_REPS = /^(\d{1,2})\s*[x×]\s*(.+)$/i;

export function parseWorkoutLine(raw: string): WorkoutLine | null {
  const line = raw.trim();
  if (line === "") return null;

  if (line.endsWith(":")) {
    return { type: "heading", text: line.slice(0, -1).trim() };
  }

  const sepMatch = EXERCISE_SEP.exec(line);
  if (sepMatch && sepMatch.index > 0) {
    const name = line.slice(0, sepMatch.index).trim();
    const detail = line.slice(sepMatch.index + sepMatch[0].length).trim();
    if (name !== "" && detail !== "") {
      // Vægt: alt efter '@' ("@ 16 kg" → "16 kg")
      let weight: string | null = null;
      let rest = detail;
      const at = detail.indexOf("@");
      if (at >= 0) {
        weight = detail.slice(at + 1).trim() || null;
        rest = detail.slice(0, at).trim();
      }
      const sr = SETS_REPS.exec(rest);
      return {
        type: "exercise",
        name,
        detail,
        sets: sr ? Number(sr[1]) : null,
        reps: sr ? sr[2].trim() : null,
        weight,
      };
    }
  }

  return { type: "note", text: line };
}

export function parseWorkoutBody(body: string): WorkoutLine[] {
  return body
    .split("\n")
    .map(parseWorkoutLine)
    .filter((l): l is WorkoutLine => l !== null);
}

export function countExercises(body: string): number {
  return parseWorkoutBody(body).filter((l) => l.type === "exercise").length;
}

// --- Progression (v3) -------------------------------------------------------

// Strip superset-labels ("A1. ", "B2) ", "3. ") foran øvelsesnavne, så
// samme øvelse grupperes på tværs af sessioner uanset programmets rækkefølge.
export function normalizeExerciseName(name: string): string {
  return name.replace(/^\s*(?:[a-zæøå]\d{1,2}|\d{1,2})[.):]\s+/i, "").trim();
}

// Grupperings-nøgle på tværs af sessioner. Ud over lowercase udvides den
// gængse forkortelse "KB" til "kettlebell", så "KB row" og "Kettlebell row"
// bliver samme serie selvom de er skrevet forskelligt.
export function exerciseGroupKey(name: string): string {
  return normalizeExerciseName(name)
    .toLowerCase()
    .replace(/\bkb\b/g, "kettlebell")
    .replace(/\s+/g, " ")
    .trim();
}

export type ExerciseLineStats = {
  reps: number | null; // højeste tal i reps-delen ('6-8' → 8)
  isSeconds: boolean; // reps-delen er tid ('30-45 sek')
  weightKg: number | null; // tal fra '@ 16 kg'
  e1rm: number | null; // estimeret 1RM (Epley): kg × (1 + reps/30)
};

// Udtræk alle plotbare tal fra en øvelses-linje. En linje som
// '4×6-8 @ 12 kg' giver BÅDE reps (8), vægt (12) og e1RM (15,2) — hvilken
// serie der vises, vælger brugeren på /statistik.
export function exerciseLineStats(
  line: Extract<WorkoutLine, { type: "exercise" }>,
): ExerciseLineStats {
  let reps: number | null = null;
  let isSeconds = false;
  if (line.reps) {
    const nums = [...line.reps.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) =>
      Number(m[0].replace(",", ".")),
    );
    if (nums.length > 0) {
      reps = Math.max(...nums);
      isSeconds = /sek/i.test(line.reps);
    }
  }
  let weightKg: number | null = null;
  if (line.weight) {
    const m = /(\d+(?:[.,]\d+)?)/.exec(line.weight);
    if (m) weightKg = Number(m[1].replace(",", "."));
  }
  const e1rm =
    weightKg !== null
      ? reps !== null && !isSeconds
        ? Math.round(weightKg * (1 + reps / 30) * 10) / 10
        : weightKg
      : null;
  return { reps, isSeconds, weightKg, e1rm };
}
