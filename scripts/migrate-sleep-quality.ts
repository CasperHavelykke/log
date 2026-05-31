import Database from "better-sqlite3";

const db = new Database("F:/ikke-synkroniseret/log/data/app.db");

const result = db
  .prepare(
    `UPDATE day_entries
     SET sleep_quality = CASE
       WHEN sleep_quality = 5 THEN 4
       WHEN sleep_quality = 4 THEN 3
       WHEN sleep_quality = 3 THEN 2
       WHEN sleep_quality = 2 THEN 1
       WHEN sleep_quality = 1 THEN 1
       ELSE sleep_quality
     END
     WHERE sleep_quality IS NOT NULL`,
  )
  .run();

console.log(`Opdaterede ${result.changes} rækker.`);

const after = db
  .prepare("SELECT date, sleep_quality FROM day_entries WHERE sleep_quality IS NOT NULL ORDER BY date")
  .all();
console.log(after);
