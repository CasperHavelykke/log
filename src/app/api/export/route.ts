import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { eq } from "drizzle-orm";
import { zipSync, strToU8, type Zippable } from "fflate";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const BLOB_ROOT = resolve(process.cwd(), "data");

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
    jobSearchPeriods,
    applicationEvents,
    weekGoals,
    supplements,
    supplementIntakes,
    sleepEntries,
    fasts,
    drinkSessions,
    drinkLogsRows,
    customParameters,
    customParameterValues,
    trackers,
    photos,
    documents,
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
      .from(schema.jobSearchPeriods)
      .where(eq(schema.jobSearchPeriods.userId, user.id)),
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
    db.select().from(schema.fasts).where(eq(schema.fasts.userId, user.id)),
    db.select().from(schema.drinkSessions).where(eq(schema.drinkSessions.userId, user.id)),
    db.select().from(schema.drinkLogs),
    db
      .select()
      .from(schema.customParameters)
      .where(eq(schema.customParameters.userId, user.id)),
    db
      .select()
      .from(schema.customParameterValues)
      .where(eq(schema.customParameterValues.userId, user.id)),
    db.select().from(schema.trackers).where(eq(schema.trackers.userId, user.id)),
    db.select().from(schema.photos).where(eq(schema.photos.userId, user.id)),
    db.select().from(schema.documents).where(eq(schema.documents.userId, user.id)),
  ]);

  // drinkLogs har ingen userId — filtrér via sessionId
  const sessionIdSet = new Set(drinkSessions.map((s) => s.id));
  const userDrinkLogs = drinkLogsRows.filter((l) => sessionIdSet.has(l.sessionId));

  const strip = <T extends { userId?: number }>(rows: T[]) =>
    rows.map(({ userId: _userId, ...rest }) => rest);

  const backup = {
    format: "log-backup",
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {
      dayEntries: strip(dayEntries),
      projects: strip(projects),
      timeEntries: strip(timeEntries),
      jobApplications: strip(jobApplications),
      jobSearchPeriods: strip(jobSearchPeriods),
      applicationEvents: strip(applicationEvents),
      weekGoals: strip(weekGoals),
      supplements: strip(supplements),
      supplementIntakes: strip(supplementIntakes),
      sleepEntries: strip(sleepEntries),
      fasts: strip(fasts),
      drinkSessions: strip(drinkSessions),
      drinkLogs: userDrinkLogs,
      customParameters: strip(customParameters),
      customParameterValues: strip(customParameterValues),
      trackers: strip(trackers),
      photos: strip(photos),
      documents: strip(documents),
    },
  };

  // Saml binære filer fra lokal disk under data/. Eventuelle legacy-http://
  // URL'er springes over (de er ikke længere tilgængelige).
  const zipPayload: Zippable = {
    "backup.json": strToU8(JSON.stringify(backup, null, 2)),
  };

  const missingFiles: string[] = [];

  async function addFile(blobPathname: string, archivePath: string) {
    if (!blobPathname || blobPathname.startsWith("http")) {
      if (blobPathname.startsWith("http")) missingFiles.push(blobPathname);
      return;
    }
    try {
      const buf = await readFile(join(BLOB_ROOT, blobPathname));
      zipPayload[archivePath] = new Uint8Array(buf);
    } catch {
      missingFiles.push(blobPathname);
    }
  }

  await Promise.all([
    ...photos.map((p) => addFile(p.blobPathname, `files/${p.blobPathname}`)),
    ...documents.map((d) => addFile(d.blobPathname, `files/${d.blobPathname}`)),
  ]);

  // README så brugeren forstår indholdet uden at åbne JSON'en.
  zipPayload["README.txt"] = strToU8(buildReadme(backup, missingFiles));

  const zipped = zipSync(zipPayload, { level: 6 });

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return new NextResponse(new Uint8Array(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="log-backup-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildReadme(
  backup: { exportedAt: string; data: Record<string, unknown[]> },
  missing: string[],
): string {
  const counts = Object.entries(backup.data)
    .map(([k, v]) => `  - ${k}: ${v.length}`)
    .join("\n");
  const missingBlock =
    missing.length === 0
      ? "Alle filer er inkluderet."
      : `${missing.length} fil(er) kunne ikke pakkes ind (filen findes ikke på disk eller pegen er legacy http://). Ramte stier:\n${missing.map((m) => `  - ${m}`).join("\n")}`;

  return [
    "Log – fuld backup",
    `Eksporteret: ${backup.exportedAt}`,
    "",
    "Indhold:",
    "  backup.json     – al database-data (uden auth/oauth-tabeller).",
    "  files/photos/   – billed-filer fra dine trackere.",
    "  files/documents/– CV, ansøgninger og øvrige uploadede dokumenter.",
    "",
    "Rækker per tabel:",
    counts,
    "",
    missingBlock,
    "",
    "Importér via /indstillinger → 'Importér og erstat alt'.",
    "ZIP'en kan også åbnes manuelt med ethvert ZIP-program.",
    "",
  ].join("\n");
}
