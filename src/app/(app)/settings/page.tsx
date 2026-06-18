import { requireUser } from "@/lib/session";
import { SettingsPage } from "./settings-page";
import { listOAuthClients } from "./oauth-actions";
import { listCustomParameters } from "@/lib/custom-parameters";
import { getActiveJobSearchPeriod } from "../jobs/period-actions";

export const metadata = { title: "Indstillinger | Log" };

export default async function Settings() {
  const user = await requireUser();
  const [clients, customParameters, activePeriod] = await Promise.all([
    listOAuthClients(),
    listCustomParameters(true),
    getActiveJobSearchPeriod(),
  ]);
  return (
    <SettingsPage
      username={user.name ?? user.email ?? ""}
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
    />
  );
}
