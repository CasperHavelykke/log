"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { parseGarminSleepCsv } from "@/lib/garmin-sleep";

type ImportResult =
  | {
      ok: true;
      date: string;
      action: "created" | "updated";
    }
  | { ok: false; filename?: string; error: string };

export async function importGarminSleepCsv(input: {
  csvText: string;
  filename?: string;
}): Promise<ImportResult> {
  const user = await requireUser();

  const parsed = parseGarminSleepCsv(input.csvText);
  if (!parsed) {
    return {
      ok: false,
      filename: input.filename,
      error: `${input.filename ? input.filename + ": " : ""}kunne ikke læses som Garmin-CSV (mangler dato eller forkert format)`,
    };
  }

  const existing = await db
    .select()
    .from(schema.sleepEntries)
    .where(
      and(
        eq(schema.sleepEntries.userId, user.id),
        eq(schema.sleepEntries.date, parsed.date),
      ),
    )
    .limit(1);

  const now = new Date().toISOString();
  const values = {
    userId: user.id,
    date: parsed.date,
    source: "garmin" as const,
    durationMin: parsed.durationMin,
    score: parsed.score,
    qualityLabel: parsed.qualityLabel,
    deepMin: parsed.deepMin,
    lightMin: parsed.lightMin,
    remMin: parsed.remMin,
    awakeMin: parsed.awakeMin,
    avgStress: parsed.avgStress,
    breathingVariation: parsed.breathingVariation,
    restlessMoments: parsed.restlessMoments,
    avgHeartRate: parsed.avgHeartRate,
    restingHeartRate: parsed.restingHeartRate,
    bodyBatteryChange: parsed.bodyBatteryChange,
    avgSpO2: parsed.avgSpO2,
    lowestSpO2: parsed.lowestSpO2,
    avgBreathingX10: parsed.avgBreathingX10,
    lowestBreathingX10: parsed.lowestBreathingX10,
    hrvMs: parsed.hrvMs,
    hrv7dStatus: parsed.hrv7dStatus,
    rawSource: input.csvText,
    updatedAt: now,
  };

  let action: "created" | "updated";
  if (existing[0]) {
    await db
      .update(schema.sleepEntries)
      .set(values)
      .where(eq(schema.sleepEntries.id, existing[0].id));
    action = "updated";
  } else {
    await db.insert(schema.sleepEntries).values(values);
    action = "created";
  }

  // Bemærk: vi opdaterer IKKE dayEntries.sleepHours/sleepQuality fra Garmin.
  // I stedet vinder Garmin-værdier ved visning (se effectiveSleep helpers).
  // Manuelle indtastninger bevares som de er.

  revalidatePath("/health");
  revalidatePath("/today");
  revalidatePath("/");

  return { ok: true, date: parsed.date, action };
}

export async function deleteSleepEntry(date: string) {
  const user = await requireUser();
  await db
    .delete(schema.sleepEntries)
    .where(
      and(
        eq(schema.sleepEntries.userId, user.id),
        eq(schema.sleepEntries.date, date),
      ),
    );
  revalidatePath("/health");
  return { ok: true as const };
}
