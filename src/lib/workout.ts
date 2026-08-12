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
