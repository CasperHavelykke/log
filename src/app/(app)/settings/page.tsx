import { and, eq, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import { getThemePreference } from "@/lib/theme";
import { SettingsPage } from "./settings-page";
import { listOAuthClients } from "./oauth-actions";
import { listCustomParameters } from "@/lib/custom-parameters";
import {
  getActiveJobSearchPeriod,
  listJobSearchPeriods,
} from "../jobs/period-actions";

export const metadata = { title: "Indstillinger | Log" };

export default async function Settings() {
  const user = await requireUser();
  const fasteEnabled = user.fasteEnabled ?? false;
  const garminSleepEnabled = user.garminSleepEnabled ?? false;
  const trainingEnabled = user.trainingEnabled ?? false;
  const goalsEnabled = user.goalsEnabled ?? false;
  const themePreference = await getThemePreference();
  const [clients, customParameters, activePeriod, allPeriods, allApps] =
    await Promise.all([
      listOAuthClients(),
      listCustomParameters(true),
      getActiveJobSearchPeriod(),
      listJobSearchPeriods(),
      db
        .select({
          id: schema.jobApplications.id,
          sentAt: schema.jobApplications.sentAt,
        })
        .from(schema.jobApplications)
        .where(
          and(
            eq(schema.jobApplications.userId, user.id),
            isNotNull(schema.jobApplications.sentAt),
          ),
        ),
    ]);

  // Tæl ansøgninger per periode (fra sentAt inden for startedAt..endedAt).
  const pastPeriods = allPeriods
    .filter((p) => p.endedAt !== null)
    .map((p) => {
      const end = p.endedAt ?? "9999-12-31";
      const count = allApps.filter(
        (a) => a.sentAt !== null && a.sentAt >= p.startedAt && a.sentAt <= end,
      ).length;
      return {
        id: p.id,
        name: p.name,
        startedAt: p.startedAt,
        endedAt: p.endedAt!,
        applicationCount: count,
      };
    });

  return (
    <SettingsPage
      username={user.name ?? user.email ?? ""}
      email={user.email ?? ""}
      initialClients={clients.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        name: c.name,
        redirectUris: c.redirectUris,
        createdAt: c.createdAt,
      }))}
      initialCustomParameters={customParameters}
      initialActivePeriod={
        activePeriod
          ? {
              id: activePeriod.id,
              name: activePeriod.name,
              startedAt: activePeriod.startedAt,
            }
          : null
      }
      initialPastPeriods={pastPeriods}
      initialFasteEnabled={fasteEnabled}
      initialGarminSleepEnabled={garminSleepEnabled}
      initialTrainingEnabled={trainingEnabled}
      initialGoalsEnabled={goalsEnabled}
      initialTheme={themePreference}
    />
  );
}
