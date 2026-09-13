/**
 * Seeder demo-databasen med ~90 dages fiktiv men troværdig data.
 *
 * Brug (peger ALDRIG på den rigtige DB — kræver eksplicit sti):
 *   DATABASE_URL=file:./data-demo/app.db npx tsx scripts/seed-demo.ts
 *
 * Scriptet er idempotent på den hårde måde: det NULSTILLER demo-brugerens
 * data fuldstændigt før genopbygning. Kør apply-migrations først:
 *   DATABASE_URL=file:./data-demo/app.db npx tsx scripts/apply-migrations.ts
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const DEMO_EMAIL = "demo@loggen.app";

const url = process.env.DATABASE_URL;
if (!url || !url.includes("demo")) {
  console.error(
    "Sikkerhedsstop: DATABASE_URL skal sættes eksplicit og indeholde 'demo'.",
  );
  console.error(
    "  DATABASE_URL=file:./data-demo/app.db npx tsx scripts/seed-demo.ts",
  );
  process.exit(1);
}
if (url.startsWith("file:")) {
  mkdirSync(dirname(resolve(url.slice("file:".length))), { recursive: true });
}

const client = createClient({ url });
const db = drizzle(client, { schema });

// Deterministisk pseudo-random så seed'en er reproducerbar.
let rngState = 42;
function rng(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function chance(p: number): boolean {
  return rng() < p;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekday(iso: string): number {
  // 0 = mandag
  return (new Date(iso + "T12:00:00").getDay() + 6) % 7;
}
function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - weekday(iso));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAYS = 92;

async function main() {
  console.log("Seeder demo-data mod", url);

  // --- Demo-bruger (nulstil helt hvis den findes) ---------------------------
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);
  if (existing[0]) {
    // Cascade rydder alt brugerdata.
    await db.delete(schema.users).where(eq(schema.users.id, existing[0].id));
    console.log("Eksisterende demo-bruger nulstillet");
  }

  const [user] = await db
    .insert(schema.users)
    .values({
      email: DEMO_EMAIL,
      name: "Demo",
      fasteEnabled: true,
      garminSleepEnabled: true,
      trainingEnabled: true,
    })
    .returning();
  const uid = user.id;

  // --- Projekter + fokus ----------------------------------------------------
  const projectRows = await db
    .insert(schema.projects)
    .values([
      { userId: uid, name: "Sideprojekt: Havekassen", sortOrder: 0 },
      { userId: uid, name: "Jobsøgning", sortOrder: 1 },
      { userId: uid, name: "Læsning & kurser", sortOrder: 2 },
    ])
    .returning();
  await db
    .update(schema.users)
    .set({ focusProjectId: projectRows[0].id })
    .where(eq(schema.users.id, uid));

  // --- Kosttilskud ----------------------------------------------------------
  const suppRows = await db
    .insert(schema.supplements)
    .values([
      {
        userId: uid,
        name: "D-vitamin",
        defaultDoseAmountX100: 3800,
        defaultDoseUnit: "µg",
        defaultTimeOfDay: "morning",
        sortOrder: 0,
      },
      {
        userId: uid,
        name: "Magnesium",
        defaultDoseAmountX100: 30000,
        defaultDoseUnit: "mg",
        defaultTimeOfDay: "evening",
        sortOrder: 1,
      },
      {
        userId: uid,
        name: "Omega-3",
        defaultDoseAmountX100: 100000,
        defaultDoseUnit: "mg",
        defaultTimeOfDay: "morning",
        sortOrder: 2,
      },
    ])
    .returning();

  // --- Egne parametre -------------------------------------------------------
  const paramRows = await db
    .insert(schema.customParameters)
    .values([
      { userId: uid, name: "Hovedpine", kind: "bool_scale_10", sortOrder: 0 },
      { userId: uid, name: "Læst 30 min", kind: "boolean", sortOrder: 1 },
      { userId: uid, name: "Stress-niveau", kind: "scale_5", sortOrder: 2 },
    ])
    .returning();
  const [headache, reading, stressParam] = paramRows;

  // --- Trackere (uden fotos — upload er slået fra i demoen) -----------------
  await db.insert(schema.trackers).values([
    {
      userId: uid,
      name: "Skønhedsplet, venstre skulder",
      kind: "skin_spot",
      notes: "Holder øje månedligt — fotos udeladt i demoen.",
    },
    { userId: uid, name: "Vægt-progression", kind: "weight" },
  ]);

  // --- Jobsøgningsperiode + ansøgninger -------------------------------------
  const [period] = await db
    .insert(schema.jobSearchPeriods)
    .values({
      userId: uid,
      name: "Forår 2026",
      startedAt: isoDaysAgo(75),
    })
    .returning();
  void period;

  const companies: Array<{
    company: string;
    role: string;
    status: string;
    sentDaysAgo: number;
    events: Array<{ status: string; daysAgo: number; note?: string }>;
  }> = [
    {
      company: "Nordisk Web ApS",
      role: "Frontend-udvikler",
      status: "interview",
      sentDaysAgo: 60,
      events: [
        { status: "sent", daysAgo: 60 },
        { status: "replied", daysAgo: 52 },
        { status: "interview", daysAgo: 45, note: "God samtale — teknisk runde næste uge" },
      ],
    },
    {
      company: "Fjordsoft",
      role: "Fullstack-udvikler",
      status: "rejected",
      sentDaysAgo: 55,
      events: [
        { status: "sent", daysAgo: 55 },
        { status: "rejected", daysAgo: 40, note: "Gik med intern kandidat" },
      ],
    },
    {
      company: "GrønData",
      role: "React-udvikler",
      status: "no_response",
      sentDaysAgo: 30,
      events: [
        { status: "sent", daysAgo: 30 },
        { status: "no_response", daysAgo: 23, note: "Auto: intet svar efter 1 uge" },
      ],
    },
    {
      company: "Havnefront Digital",
      role: "TypeScript-udvikler",
      status: "sent",
      sentDaysAgo: 6,
      events: [{ status: "sent", daysAgo: 6 }],
    },
  ];

  for (const c of companies) {
    const [app] = await db
      .insert(schema.jobApplications)
      .values({
        userId: uid,
        company: c.company,
        role: c.role,
        status: c.status,
        sentAt: isoDaysAgo(c.sentDaysAgo),
        notes: null,
      })
      .returning();
    for (const e of c.events) {
      await db.insert(schema.applicationEvents).values({
        userId: uid,
        applicationId: app.id,
        status: e.status,
        note: e.note ?? null,
        occurredAt: isoDaysAgo(e.daysAgo),
      });
    }
  }

  // --- Opskrifter -----------------------------------------------------------
  await db.insert(schema.recipes).values([
    {
      userId: uid,
      title: "Kylling i karry",
      ingredients:
        "400 g kyllingebryst\n1 dåse kokosmælk\n2 spsk karry\n1 løg\n2 fed hvidløg\n1 rød peberfrugt\nEvt:\nFrisk koriander\n1 lime",
      steps:
        "Skær kyllingen i tern og brun den i gryden.\nSvits løg, hvidløg og karry med.\nHæld kokosmælken ved og lad det simre 15 min.\nSmag til med salt og lime.",
      notes: "Holder 3 dage på køl. God med jasminris eller blomkålsris.",
      servings: 4,
      carbsG: 9,
      proteinG: 32,
      fatG: 21,
      fiberG: 3,
    },
    {
      userId: uid,
      title: "Proteinæggekage",
      ingredients:
        "10 æg\n500 g mager hytteost\n185 g skinkestrimler\n300 g broccoli\n100 g revet ost\n1 tsk salt\nFriskkværnet peber",
      steps:
        "Tænd ovnen på 180 °C.\nBlancher broccolien 2 minutter.\nPisk æg og hytteost sammen.\nVend fyldet i og hæld massen i et smurt fad.\nBag 35-40 minutter til midten er sat.",
      notes:
        "Makroer for hele fadet: ~198 g protein. Seks portioner à ~33 g protein.\nHolder 3-4 dage på køl.",
      servings: 6,
      carbsG: 7,
      proteinG: 33,
      fatG: 17,
      fiberG: 2,
    },
    {
      userId: uid,
      title: "Overnight oats med bær",
      ingredients:
        "1 dl havregryn\n1,5 dl skyr\n1 dl mælk\n1 spsk chiafrø\n100 g blandede bær\n1 tsk honning",
      steps:
        "Rør havregryn, skyr, mælk og chiafrø sammen.\nStil på køl natten over.\nTop med bær og honning om morgenen.",
      notes: null,
      servings: 1,
      carbsG: 52,
      proteinG: 24,
      fatG: 9,
      fiberG: 8,
    },
  ]);

  // --- Trænings-skabeloner --------------------------------------------------
  const templateRows = await db.insert(schema.workoutTemplates).values([
    {
      userId: uid,
      title: "Pull + press",
      durationMin: 40,
      body: "Chin-ups — 4×4\nKB strict press, én arm — 4×6-8 @ 16 kg\nKB row, én arm — 3×10-12 @ 16 kg\nTil slut:\nDead hang — 2×40 sek",
    },
    {
      userId: uid,
      title: "Push + ben",
      durationMin: 45,
      body: "Armhævelser på greb — 3×10\nGoblet squat — 4×10 @ 16 kg\nPike push-ups — 3×8-12\nBulgarian split squat — 3×8 per ben",
    },
  ]).returning();

  // --- Planlægger -----------------------------------------------------------
  await db.insert(schema.planItems).values([
    {
      userId: uid,
      kind: "supplement",
      label: suppRows[0].name, // D-vitamin — planer bindes via navn
      doseTargetX100: suppRows[0].defaultDoseAmountX100,
      doseUnit: suppRows[0].defaultDoseUnit,
      scheduleType: "interval",
      intervalDays: 1,
      anchorDate: isoDaysAgo(30),
      timeOfDay: "morgen",
      sortOrder: 0,
    },
    {
      userId: uid,
      kind: "supplement",
      label: suppRows[1].name, // Magnesium
      doseTargetX100: suppRows[1].defaultDoseAmountX100,
      doseUnit: suppRows[1].defaultDoseUnit,
      scheduleType: "interval",
      intervalDays: 2,
      anchorDate: isoDaysAgo(30),
      timeOfDay: "aften",
      sortOrder: 1,
    },
    {
      userId: uid,
      kind: "training",
      workoutTemplateId: templateRows[0].id, // Pull + press
      scheduleType: "weekdays",
      weekdays: "0,4",
      sortOrder: 2,
    },
    {
      userId: uid,
      kind: "training",
      workoutTemplateId: templateRows[1].id, // Push + ben
      scheduleType: "weekdays",
      weekdays: "2",
      sortOrder: 3,
    },
    {
      userId: uid,
      kind: "project",
      projectId: projectRows[0].id, // Havekassen
      scheduleType: "weekdays",
      weekdays: "0,1,2,3,4",
      minutesPlanned: 120,
      timeOfDay: "formiddag",
      sortOrder: 4,
    },
    {
      userId: uid,
      kind: "nutrition",
      label: "Dagens mål",
      scheduleType: "interval",
      intervalDays: 1,
      anchorDate: isoDaysAgo(30),
      kcalTarget: 2200,
      proteinTargetG: 150,
      fiberTargetG: 30,
      sortOrder: 5,
    },
    {
      userId: uid,
      kind: "meal",
      label: "Meal prep til ugen",
      scheduleType: "weekdays",
      weekdays: "6",
      timeOfDay: "aften",
      sortOrder: 6,
    },
  ]);

  // --- 92 dages dagsdata ----------------------------------------------------
  // Fortælling: vægt falder langsomt 84,5 → 81, træning man/ons/fre + lør,
  // humør/energi svinger med søvnen, alkohol mest i weekender.
  let weight = 84.5;
  const fastRows: Array<typeof schema.fasts.$inferInsert> = [];

  for (let ago = DAYS; ago >= 0; ago--) {
    const date = isoDaysAgo(ago);
    const wd = weekday(date);
    const isWeekend = wd >= 5;
    const trained = [0, 2, 4].includes(wd) ? chance(0.85) : wd === 5 ? chance(0.5) : false;

    // Søvn (Garmin): 6-8,5 timer, dårligere efter alkohol-aftener
    const drankYesterday = isWeekend && chance(0.4);
    const sleepMin = randInt(370, 505) - (drankYesterday ? randInt(30, 70) : 0);
    const sleepScore = Math.max(
      35,
      Math.min(96, Math.round(sleepMin / 6) + randInt(-12, 10) - (drankYesterday ? 12 : 0)),
    );

    const mood = Math.max(1, Math.min(5, 3 + (sleepScore > 75 ? 1 : 0) + randInt(-1, 1)));
    const energy = Math.max(1, Math.min(5, mood + randInt(-1, 1)));

    weight -= 0.038 + (rng() - 0.45) * 0.12;
    const logWeight = chance(0.7);

    const alcohol = isWeekend && chance(0.45) ? randInt(2, 8) : chance(0.06) ? randInt(1, 2) : 0;

    // Makroer logges de fleste dage
    const logMacros = chance(0.8);
    const carbs = logMacros ? randInt(120, 260) : null;
    const protein = logMacros ? randInt(110, 170) : null;
    const fat = logMacros ? randInt(45, 95) : null;
    const fiber = logMacros ? randInt(18, 42) : null;

    await db.insert(schema.dayEntries).values({
      userId: uid,
      date,
      mood,
      energy,
      alcoholUnits: alcohol > 0 ? alcohol : null,
      didExercise: trained,
      exerciseIntensity: trained ? (chance(0.4) ? "hard" : "medium") : null,
      weightX10: logWeight ? Math.round(weight * 10) : null,
      waistX10: logWeight && chance(0.5) ? Math.round((weight + 8) * 10) : null,
      carbsG: carbs,
      proteinG: protein,
      fatG: fat,
      fiberG: fiber,
      workNotes: chance(0.3)
        ? "God fokusdag — kom igennem det planlagte."
        : null,
      wentWell: chance(0.25) ? "Holdt træningsplanen." : null,
      nextStep: chance(0.25) ? "Følge op på ansøgningen til Nordisk Web." : null,
    });

    // Træningssessioner (avanceret tracking er slået til for demo-brugeren).
    // Mandag/fredag = pull, onsdag = push, lørdag = løbetur.
    if (trained && chance(0.85)) {
      const isRun = wd === 5;
      const isPull = wd === 0 || wd === 4;
      await db.insert(schema.workouts).values({
        userId: uid,
        date,
        title: isRun ? "Løbetur" : isPull ? "Pull + press" : "Push + ben",
        durationMin: isRun ? randInt(28, 45) : randInt(35, 55),
        body: isRun
          ? `${(4 + rng() * 3).toFixed(1).replace(".", ",")} km i roligt tempo\nAfslut med 4 stigningsløb`
          : isPull
            ? "Chin-ups — 4×" +
              randInt(3, 6) +
              "\nKB strict press, én arm — 4×6-8 @ 16 kg\nKB row, én arm — 3×10-12 @ 16 kg\nTil slut:\nDead hang — 2×" +
              randInt(30, 45) +
              " sek"
            : "Armhævelser på greb — 3×" +
              randInt(8, 14) +
              "\nGoblet squat — 4×10 @ 16 kg\nPike push-ups — 3×8-12\nBulgarian split squat — 3×8 per ben",
        createdAt: `${date}T18:30:00.000Z`,
        updatedAt: `${date}T18:30:00.000Z`,
      });
    }

    // Garmin-søvn
    await db.insert(schema.sleepEntries).values({
      userId: uid,
      date,
      source: "garmin",
      durationMin: sleepMin,
      score: sleepScore,
      deepMin: randInt(50, 95),
      lightMin: randInt(180, 260),
      remMin: randInt(70, 120),
      awakeMin: randInt(5, 35),
      restingHeartRate: randInt(48, 58),
      hrvMs: randInt(38, 72),
      avgSpO2: randInt(93, 98),
      avgStress: randInt(18, 42),
      bodyBatteryChange: randInt(35, 75),
    });

    // Faste: 16:8-agtig ca. hver anden dag
    if (chance(0.5)) {
      const startHour = randInt(18, 20);
      const lenMin = randInt(15 * 60, 17 * 60 + 30);
      const start = new Date(date + "T00:00:00");
      start.setDate(start.getDate() - 1);
      start.setHours(startHour, randInt(0, 59), 0, 0);
      const end = new Date(start.getTime() + lenMin * 60_000);
      fastRows.push({
        userId: uid,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
      });
    }

    // Kosttilskud: D-vitamin+Omega-3 morgen (85 %), Magnesium aften (70 %)
    for (const s of suppRows) {
      const p = s.name === "Magnesium" ? 0.7 : 0.85;
      if (chance(p)) {
        await db.insert(schema.supplementIntakes).values({
          userId: uid,
          supplementId: s.id,
          name: s.name,
          date,
          doseAmountX100: s.defaultDoseAmountX100,
          doseUnit: s.defaultDoseUnit,
          timeOfDay: s.defaultTimeOfDay,
        });
      }
    }

    // Egne parametre
    if (chance(0.18)) {
      await db.insert(schema.customParameterValues).values({
        userId: uid,
        parameterId: headache.id,
        date,
        valueBool: true,
        valueInt: randInt(2, 7),
      });
    }
    await db.insert(schema.customParameterValues).values({
      userId: uid,
      parameterId: reading.id,
      date,
      valueBool: chance(0.55),
    });
    if (chance(0.75)) {
      await db.insert(schema.customParameterValues).values({
        userId: uid,
        parameterId: stressParam.id,
        date,
        valueInt: randInt(1, 4),
      });
    }

    // Tid på projekter: hverdage mest
    if (!isWeekend || chance(0.3)) {
      const proj = projectRows[randInt(0, projectRows.length - 1)];
      await db.insert(schema.timeEntries).values({
        userId: uid,
        projectId: proj.id,
        date,
        hoursX10: randInt(5, 45),
      });
    }
  }

  await db.insert(schema.fasts).values(fastRows);

  // --- Ugemål for indeværende uge -------------------------------------------
  await db.insert(schema.weekGoals).values({
    userId: uid,
    weekStart: mondayOf(isoDaysAgo(0)),
    text: "",
    applicationsTarget: 3,
    focusHoursTargetX10: 150,
  });

  // Dagens mål-notat
  await db
    .update(schema.dayEntries)
    .set({
      goalNote:
        "Ship Havekassen v0.2. Én målrettet ansøgning. Træning kl. 17.",
    })
    .where(eq(schema.dayEntries.date, isoDaysAgo(0)));

  console.log(`Demo-data seeded: bruger #${uid}, ${DAYS + 1} dage.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed fejlede:");
    console.error(err);
    process.exit(1);
  });
