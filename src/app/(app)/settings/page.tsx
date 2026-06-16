import { requireUser } from "@/lib/session";
import { SettingsPage } from "./settings-page";
import { listOAuthClients } from "./oauth-actions";
import { listCustomParameters } from "@/lib/custom-parameters";

export const metadata = { title: "Indstillinger | Log" };

export default async function Settings() {
  const user = await requireUser();
  const [clients, customParameters] = await Promise.all([
    listOAuthClients(),
    listCustomParameters(true),
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
    />
  );
}
