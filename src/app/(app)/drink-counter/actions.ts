"use server";

import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { todayIsoDate } from "@/lib/date";
import {
  KIND_UNITS_X10,
  type ActiveSessionPayload,
  type DrinkKind,
} from "./constants";

export async function getActiveSession(): Promise<ActiveSessionPayload | null> {
  const user = await requireUser();
  const sessions = await db
    .select()
    .from(schema.drinkSessions)
    .where(
      and(
        eq(schema.drinkSessions.userId, user.id),
        isNull(schema.drinkSessions.endedAt),
      ),
    )
    .limit(1);
  const session = sessions[0];
  if (!session) return null;

  const logs = await db
    .select()
    .from(schema.drinkLogs)
    .where(eq(schema.drinkLogs.sessionId, session.id))
    .orderBy(asc(schema.drinkLogs.occurredAt));

  const totalUnitsX10 = logs.reduce((sum, l) => sum + l.unitsX10, 0);

  // Seneste vejning kalibrerer forbraendingen (~0,1 g alkohol/kg/time)
  // i "aktive genstande"-indikatoren. null = fald tilbage til 80 kg.
  const weightRows = await db
    .select({ weightX10: schema.dayEntries.weightX10 })
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, user.id),
        isNotNull(schema.dayEntries.weightX10),
      ),
    )
    .orderBy(desc(schema.dayEntries.date))
    .limit(1);

  return {
    id: session.id,
    sessionDate: session.sessionDate,
    startedAt: session.startedAt,
    totalUnitsX10,
    bodyWeightX10: weightRows[0]?.weightX10 ?? null,
    logs: logs.map((l) => ({
      id: l.id,
      unitsX10: l.unitsX10,
      kind: l.kind as DrinkKind,
      occurredAt: l.occurredAt,
    })),
  };
}

export async function startSession() {
  const user = await requireUser();
  const existing = await db
    .select({ id: schema.drinkSessions.id })
    .from(schema.drinkSessions)
    .where(
      and(
        eq(schema.drinkSessions.userId, user.id),
        isNull(schema.drinkSessions.endedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: false as const, error: "Der er allerede en aktiv session" };
  }
  const now = new Date().toISOString();
  const date = todayIsoDate();
  const [row] = await db
    .insert(schema.drinkSessions)
    .values({
      userId: user.id,
      sessionDate: date,
      startedAt: now,
    })
    .returning();
  revalidatePath("/", "layout");
  return { ok: true as const, sessionId: row.id };
}

export async function addDrink(input: { kind: DrinkKind }) {
  const user = await requireUser();
  const session = await getActiveSession();
  if (!session) {
    return { ok: false as const, error: "Ingen aktiv session" };
  }
  const unitsX10 = KIND_UNITS_X10[input.kind];
  if (!unitsX10) {
    return { ok: false as const, error: "Ukendt drink-type" };
  }
  const now = new Date().toISOString();
  const inserted = await db
    .insert(schema.drinkLogs)
    .values({
      sessionId: session.id,
      // Legacy-kolonnen holdes afrundet ajour af hensyn til gamle backups.
      unitCount: Math.round(unitsX10 / 10),
      unitsX10,
      kind: input.kind,
      occurredAt: now,
    })
    .returning();
  // Dagens alkohol-heltal bumpes DRIFT-FRIT: forskellen mellem afrundet
  // total før og efter — så seks 0,2-shots bliver til 1 genstand på dagen,
  // ikke 0 (afrundede deltaer ville tabe alle småbidder).
  await bumpAlcoholUnits(
    user.id,
    session.sessionDate,
    Math.round((session.totalUnitsX10 + unitsX10) / 10) -
      Math.round(session.totalUnitsX10 / 10),
  );
  revalidatePath("/", "layout");
  // Klienten skal bruge det RIGTIGE id — fabrikerede optimistiske id'er
  // gjorde fortryd stille brudt (ramte en ikke-eksisterende række).
  return { ok: true as const, log: inserted[0] };
}

export async function removeDrink(input: { logId: number }) {
  const user = await requireUser();
  const session = await getActiveSession();
  if (!session) {
    return { ok: false as const, error: "Ingen aktiv session" };
  }
  const rows = await db
    .select()
    .from(schema.drinkLogs)
    .where(eq(schema.drinkLogs.id, input.logId))
    .limit(1);
  const log = rows[0];
  if (!log || log.sessionId !== session.id) {
    return { ok: false as const, error: "Indtag findes ikke" };
  }
  await db.delete(schema.drinkLogs).where(eq(schema.drinkLogs.id, log.id));
  await bumpAlcoholUnits(
    user.id,
    session.sessionDate,
    Math.round((session.totalUnitsX10 - log.unitsX10) / 10) -
      Math.round(session.totalUnitsX10 / 10),
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function endSession() {
  const user = await requireUser();
  const session = await getActiveSession();
  if (!session) return { ok: true as const };
  await db
    .update(schema.drinkSessions)
    .set({ endedAt: new Date().toISOString() })
    .where(eq(schema.drinkSessions.id, session.id));
  if (session.logs.length === 0) {
    await db
      .delete(schema.drinkSessions)
      .where(
        and(
          eq(schema.drinkSessions.id, session.id),
          eq(schema.drinkSessions.userId, user.id),
        ),
      );
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

async function bumpAlcoholUnits(
  userId: number,
  date: string,
  delta: number,
) {
  const existing = await db
    .select()
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, userId),
        eq(schema.dayEntries.date, date),
      ),
    )
    .limit(1);
  const now = new Date().toISOString();
  if (existing[0]) {
    const current = existing[0].alcoholUnits ?? 0;
    const next = Math.max(0, current + delta);
    await db
      .update(schema.dayEntries)
      .set({ alcoholUnits: next, updatedAt: now })
      .where(eq(schema.dayEntries.id, existing[0].id));
  } else if (delta > 0) {
    await db.insert(schema.dayEntries).values({
      userId,
      date,
      alcoholUnits: delta,
    });
  }
}
