import { readFileSync } from "node:fs";
import { parseGarminSleepCsv } from "../src/lib/garmin-sleep";

const csv = readFileSync("C:/Users/cadlh/Downloads/Søvn.csv", "utf8");
const parsed = parseGarminSleepCsv(csv);
console.log(JSON.stringify(parsed, null, 2));
