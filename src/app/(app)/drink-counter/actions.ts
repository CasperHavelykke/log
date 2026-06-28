"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { todayIsoDate } from "@/lib/date";

export type DrinkKind = "genstand" | "shot" | "stærk_shot";

const KIND_UNITS: Record<DrinkKind, number> = {
  genstand: 1,
  shot: 1,
  stærk_shot: 2,
};

// Estimerede kalorier per indtag. Genstand ≈ øl/vin/drink (varierer 80-150);
// shot ≈ snaps/spiritus 4cl; stærk_shot ≈ dobbelt 4cl 40%+.
export const KIND_KCAL: Record<DrinkKind, number> = {
  genstand: 100,
  shot: 95,
  stærk_shot: 130,
};

export type ActiveSessionPayload = {
  id: number;
  sessionDate: string;
  startedAt: string;
  totalUnits: number;
  logs: Array<{
    id: number;
    unitCount: number;
    kind: DrinkKind;
    occurredAt: string;
  }>;
};

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

  const totalUnits = logs.reduce((sum, l) => sum + l.unitCount, 0);

  return {
    id: session.id,
    sessionDate: session.sessionDate,
    startedAt: session.startedAt,
    totalUnits,
    logs: logs.map((l) => ({
      id: l.id,
      unitCount: l.unitCount,
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
  const units = KIND_UNITS[input.kind];
  if (!units) {
    return { ok: false as const, error: "Ukendt drink-type" };
  }
  const now = new Date().toISOString();
  await db.insert(schema.drinkLogs).values({
    sessionId: session.id,
    unitCount: units,
    kind: input.kind,
    occurredAt: now,
  });
  await bumpAlcoholUnits(user.id, session.sessionDate, units);
  revalidatePath("/", "layout");
  return { ok: true as const };
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
  await bumpAlcoholUnits(user.id, session.sessionDate, -log.unitCount);
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
