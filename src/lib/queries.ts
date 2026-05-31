import "server-only";

import { and, asc, between, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

export async function getDayEntry(userId: number, date: string) {
  const rows = await db
    .select()
    .from(schema.dayEntries)
    .where(
      and(eq(schema.dayEntries.userId, userId), eq(schema.dayEntries.date, date)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getWeekGoal(userId: number, weekStart: string) {
  const rows = await db
    .select()
    .from(schema.weekGoals)
    .where(
      and(
        eq(schema.weekGoals.userId, userId),
        eq(schema.weekGoals.weekStart, weekStart),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveProjects(userId: number) {
  return db
    .select()
    .from(schema.projects)
    .where(
      and(eq(schema.projects.userId, userId), eq(schema.projects.archived, false)),
    )
    .orderBy(asc(schema.projects.sortOrder), asc(schema.projects.name));
}

export async function getTimeEntryForFocus(
  userId: number,
  projectId: number,
  date: string,
) {
  const rows = await db
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        eq(schema.timeEntries.userId, userId),
        eq(schema.timeEntries.projectId, projectId),
        eq(schema.timeEntries.date, date),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getApplicationsSentOn(userId: number, date: string) {
  return db
    .select()
    .from(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.userId, userId),
        eq(schema.jobApplications.sentAt, date),
      ),
    )
    .orderBy(asc(schema.jobApplications.createdAt));
}

export async function getAllJobApplications(userId: number) {
  return db
    .select()
    .from(schema.jobApplications)
    .where(eq(schema.jobApplications.userId, userId))
    .orderBy(desc(schema.jobApplications.sentAt), desc(schema.jobApplications.id));
}

export async function getAllApplicationEvents(userId: number) {
  return db
    .select()
    .from(schema.applicationEvents)
    .where(eq(schema.applicationEvents.userId, userId))
    .orderBy(
      asc(schema.applicationEvents.occurredAt),
      asc(schema.applicationEvents.id),
    );
}

export async function getAllProjects(userId: number) {
  return db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId))
    .orderBy(
      asc(schema.projects.archived),
      asc(schema.projects.sortOrder),
      asc(schema.projects.name),
    );
}

export async function getAllTimeEntries(userId: number) {
  return db
    .select()
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.userId, userId))
    .orderBy(desc(schema.timeEntries.date), desc(schema.timeEntries.id));
}

export async function getAllDayEntries(userId: number) {
  return db
    .select()
    .from(schema.dayEntries)
    .where(eq(schema.dayEntries.userId, userId))
    .orderBy(desc(schema.dayEntries.date));
}

export async function getAllSleepEntries(userId: number) {
  return db
    .select()
    .from(schema.sleepEntries)
    .where(eq(schema.sleepEntries.userId, userId))
    .orderBy(desc(schema.sleepEntries.date));
}

export async function getActiveSupplements(userId: number) {
  return db
    .select()
    .from(schema.supplements)
    .where(
      and(
        eq(schema.supplements.userId, userId),
        eq(schema.supplements.archived, false),
      ),
    )
    .orderBy(asc(schema.supplements.sortOrder), asc(schema.supplements.name));
}

export async function getAllSupplements(userId: number) {
  return db
    .select()
    .from(schema.supplements)
    .where(eq(schema.supplements.userId, userId))
    .orderBy(asc(schema.supplements.sortOrder), asc(schema.supplements.name));
}

export async function getActiveFast(userId: number) {
  const rows = await db
    .select()
    .from(schema.fasts)
    .where(
      and(eq(schema.fasts.userId, userId), isNull(schema.fasts.endedAt)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getRecentFasts(userId: number, limit = 5) {
  return db
    .select()
    .from(schema.fasts)
    .where(eq(schema.fasts.userId, userId))
    .orderBy(desc(schema.fasts.startedAt))
    .limit(limit);
}

export async function getSupplementIntakesOnDate(
  userId: number,
  date: string,
) {
  return db
    .select()
    .from(schema.supplementIntakes)
    .where(
      and(
        eq(schema.supplementIntakes.userId, userId),
        eq(schema.supplementIntakes.date, date),
      ),
    )
    .orderBy(asc(schema.supplementIntakes.id));
}

export async function getDayEntriesInRange(
  userId: number,
  from: string,
  to: string,
) {
  return db
    .select()
    .from(schema.dayEntries)
    .where(
      and(
        eq(schema.dayEntries.userId, userId),
        between(schema.dayEntries.date, from, to),
      ),
    )
    .orderBy(asc(schema.dayEntries.date));
}

export async function getTimeEntriesInRange(
  userId: number,
  from: string,
  to: string,
) {
  return db
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        eq(schema.timeEntries.userId, userId),
        between(schema.timeEntries.date, from, to),
      ),
    );
}
