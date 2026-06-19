"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { deleteBlob } from "@/lib/blob";

export type AccountSummary = {
  dayEntries: number;
  projects: number;
  timeEntries: number;
  jobApplications: number;
  sleepEntries: number;
  fasts: number;
  supplements: number;
  trackers: number;
  customParameters: number;
  photos: number;
  documents: number;
};

export async function getAccountSummary(): Promise<AccountSummary> {
  const user = await requireUser();
  const [
    dayEntries,
    projects,
    timeEntries,
    jobApplications,
    sleepEntries,
    fasts,
    supplements,
    trackers,
    customParameters,
    photos,
    documents,
  ] = await Promise.all([
    db.select({ id: schema.dayEntries.id }).from(schema.dayEntries).where(eq(schema.dayEntries.userId, user.id)),
    db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.userId, user.id)),
    db.select({ id: schema.timeEntries.id }).from(schema.timeEntries).where(eq(schema.timeEntries.userId, user.id)),
    db.select({ id: schema.jobApplications.id }).from(schema.jobApplications).where(eq(schema.jobApplications.userId, user.id)),
    db.select({ id: schema.sleepEntries.id }).from(schema.sleepEntries).where(eq(schema.sleepEntries.userId, user.id)),
    db.select({ id: schema.fasts.id }).from(schema.fasts).where(eq(schema.fasts.userId, user.id)),
    db.select({ id: schema.supplements.id }).from(schema.supplements).where(eq(schema.supplements.userId, user.id)),
    db.select({ id: schema.trackers.id }).from(schema.trackers).where(eq(schema.trackers.userId, user.id)),
    db.select({ id: schema.customParameters.id }).from(schema.customParameters).where(eq(schema.customParameters.userId, user.id)),
    db.select({ id: schema.photos.id }).from(schema.photos).where(eq(schema.photos.userId, user.id)),
    db.select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.userId, user.id)),
  ]);

  return {
    dayEntries: dayEntries.length,
    projects: projects.length,
    timeEntries: timeEntries.length,
    jobApplications: jobApplications.length,
    sleepEntries: sleepEntries.length,
    fasts: fasts.length,
    supplements: supplements.length,
    trackers: trackers.length,
    customParameters: customParameters.length,
    photos: photos.length,
    documents: documents.length,
  };
}

export async function deleteAccount(input: {
  confirmEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const expected = (user.email ?? "").trim().toLowerCase();
  const provided = input.confirmEmail.trim().toLowerCase();
  if (!expected || provided !== expected) {
    return { ok: false, error: "Email matcher ikke kontoens email" };
  }

  // Collect blob references before the cascade nukes them.
  const [photoBlobs, docBlobs] = await Promise.all([
    db
      .select({ url: schema.photos.blobUrl, pathname: schema.photos.blobPathname })
      .from(schema.photos)
      .where(eq(schema.photos.userId, user.id)),
    db
      .select({ url: schema.documents.blobUrl, pathname: schema.documents.blobPathname })
      .from(schema.documents)
      .where(eq(schema.documents.userId, user.id)),
  ]);

  // Best-effort blob cleanup. deleteBlob swallows not-found errors,
  // so orphaned blobs are the only risk if Vercel Blob is down — acceptable.
  await Promise.all(
    [...photoBlobs, ...docBlobs].map((b) =>
      deleteBlob(b.pathname || b.url).catch(() => undefined),
    ),
  );

  // Cascading FKs handle all related rows (day_entries, projects, time_entries,
  // job_applications, application_events, sleep_entries, fasts, supplements,
  // supplement_intakes, week_goals, custom_parameters, custom_parameter_values,
  // trackers, photos, documents, oauth_clients/codes/tokens, accounts,
  // auth_sessions, job_search_periods).
  await db.delete(schema.users).where(eq(schema.users.id, user.id));

  await signOut({ redirect: false });
  return { ok: true };
}
