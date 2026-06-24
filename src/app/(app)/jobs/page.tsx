import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import {
  getAllApplicationEvents,
  getAllJobApplications,
  getWeekGoal,
} from "@/lib/queries";
import { listDocuments } from "../documents/actions";
import { JobsPage } from "./jobs-page";
import { listJobSearchPeriods } from "./period-actions";
import { mondayOf } from "@/lib/date";
import type { JobStatus } from "@/db/schema";

type PeriodOption = {
  id: number;
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
};

export const metadata = { title: "Job | Log" };

async function flagStaleSentApplications(userId: number) {
  const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();
  const now = new Date().toISOString();
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const stale = await db
    .select()
    .from(schema.jobApplications)
    .where(
      and(
        eq(schema.jobApplications.userId, userId),
        eq(schema.jobApplications.status, "sent"),
        lt(schema.jobApplications.updatedAt, cutoffIso),
      ),
    );

  for (const app of stale) {
    await db
      .update(schema.jobApplications)
      .set({ status: "no_response", updatedAt: now })
      .where(eq(schema.jobApplications.id, app.id));
    await db.insert(schema.applicationEvents).values({
      userId,
      applicationId: app.id,
      status: "no_response",
      occurredAt: today,
      note: "Auto: intet svar efter 1 uge",
    });
  }
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Jobs({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  await flagStaleSentApplications(user.id);

  const weekStart = mondayOf(new Date());
  const [apps, events, docs, periods, weekGoal] = await Promise.all([
    getAllJobApplications(user.id),
    getAllApplicationEvents(user.id),
    listDocuments(),
    listJobSearchPeriods(),
    getWeekGoal(user.id, weekStart),
  ]);

  const params = await searchParams;
  const periodParam =
    typeof params.period === "string" ? params.period : undefined;

  // Selected period:
  //   - "all" → no filter
  //   - matches a period ID → that period
  //   - else → active period (if any), else no filter
  let selectedPeriod: typeof periods[number] | null = null;
  let showAll = false;
  if (periodParam === "all") {
    showAll = true;
  } else if (periodParam) {
    const id = Number(periodParam);
    selectedPeriod = periods.find((p) => p.id === id) ?? null;
  } else {
    selectedPeriod = periods.find((p) => p.endedAt === null) ?? null;
  }

  // Filtrer apps efter periodens dato-interval (sentAt within).
  const filteredApps = (() => {
    if (showAll || !selectedPeriod) return apps;
    const end = selectedPeriod.endedAt ?? "9999-12-31";
    return apps.filter(
      (a) =>
        a.sentAt !== null &&
        a.sentAt >= selectedPeriod.startedAt &&
        a.sentAt <= end,
    );
  })();

  const filteredAppIds = new Set(filteredApps.map((a) => a.id));
  const filteredEvents = events.filter((e) =>
    filteredAppIds.has(e.applicationId),
  );

  const docsByApp = new Map<number, typeof docs>();
  for (const d of docs) {
    if (d.jobApplicationId !== null) {
      const list = docsByApp.get(d.jobApplicationId) ?? [];
      list.push(d);
      docsByApp.set(d.jobApplicationId, list);
    }
  }
  const unattached = docs
    .filter((d) => d.jobApplicationId === null)
    .map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      filename: d.filename,
      mimeType: d.mimeType,
    }));

  // Build period options for selector
  const periodOptions: PeriodOption[] = periods.map((p) => ({
    id: p.id,
    name: p.name,
    startedAt: p.startedAt,
    endedAt: p.endedAt,
    isActive: p.endedAt === null,
  }));

  const selectedPeriodOption = selectedPeriod
    ? (periodOptions.find((p) => p.id === selectedPeriod.id) ?? null)
    : null;

  return (
    <div>
      <JobsPage
        periods={periodOptions}
        selectedPeriod={selectedPeriodOption}
        showingAll={showAll}
        weekTarget={weekGoal?.applicationsTarget ?? null}
        weekStart={weekStart}
        initial={filteredApps.map((a) => ({
          id: a.id,
          company: a.company,
          role: a.role ?? "",
          status: a.status as JobStatus,
          files: a.files ?? "",
          url: a.url ?? "",
          contactPerson: a.contactPerson ?? "",
          notes: a.notes ?? "",
          applicationText: a.applicationText ?? "",
          sentAt: a.sentAt ?? "",
          updatedAt: a.updatedAt,
          documents: (docsByApp.get(a.id) ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            kind: d.kind,
            filename: d.filename,
            mimeType: d.mimeType,
          })),
        }))}
        events={filteredEvents.map((e) => ({
          id: e.id,
          applicationId: e.applicationId,
          status: e.status as JobStatus,
          occurredAt: e.occurredAt,
        }))}
        unattached={unattached}
      />
    </div>
  );
}
