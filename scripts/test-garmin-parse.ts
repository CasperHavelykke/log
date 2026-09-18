import { readFileSync } from "node:fs";
import { parseGarminSleepCsv } from "../src/lib/garmin-sleep";

// Brug: npx tsx scripts/test-garmin-parse.ts <sti-til-Søvn.csv>
const path = process.argv[2];
if (!path) {
  console.error("Angiv stien til en Garmin-søvn-CSV som argument.");
  process.exit(1);
}
const csv = readFileSync(path, "utf8");
const parsed = parseGarminSleepCsv(csv);
console.log(JSON.stringify(parsed, null, 2));
