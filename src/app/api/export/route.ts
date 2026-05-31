import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const [
    dayEntries,
    projects,
    timeEntries,
    jobApplications,
    applicationEvents,
    weekGoals,
    supplements,
    supplementIntakes,
    sleepEntries,
  ] = await Promise.all([
    db.select().from(schema.dayEntries).where(eq(schema.dayEntries.userId, user.id)),
    db.select().from(schema.projects).where(eq(schema.projects.userId, user.id)),
    db.select().from(schema.timeEntries).where(eq(schema.timeEntries.userId, user.id)),
    db
      .select()
      .from(schema.jobApplications)
      .where(eq(schema.jobApplications.userId, user.id)),
    db
      .select()
      .from(schema.applicationEvents)
      .where(eq(schema.applicationEvents.userId, user.id)),
    db.select().from(schema.weekGoals).where(eq(schema.weekGoals.userId, user.id)),
    db.select().from(schema.supplements).where(eq(schema.supplements.userId, user.id)),
    db
      .select()
      .from(schema.supplementIntakes)
      .where(eq(schema.supplementIntakes.userId, user.id)),
    db.select().from(schema.sleepEntries).where(eq(schema.sleepEntries.userId, user.id)),
  ]);

  const fasts = await db
    .select()
    .from(schema.fasts)
    .where(eq(schema.fasts.userId, user.id));

  const strip = <T extends { userId?: number }>(rows: T[]) =>
    rows.map(({ userId: _userId, ...rest }) => rest);

  const backup = {
    format: "log-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      dayEntries: strip(dayEntries),
      projects: strip(projects),
      timeEntries: strip(timeEntries),
      jobApplications: strip(jobApplications),
      applicationEvents: strip(applicationEvents),
      weekGoals: strip(weekGoals),
      supplements: strip(supplements),
      supplementIntakes: strip(supplementIntakes),
      sleepEntries: strip(sleepEntries),
      fasts: strip(fasts),
    },
  };

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="log-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
