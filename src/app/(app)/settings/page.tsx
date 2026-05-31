import { requireUser } from "@/lib/session";
import { SettingsPage } from "./settings-page";
import { listOAuthClients } from "./oauth-actions";

export const metadata = { title: "Indstillinger | Log" };

export default async function Settings() {
  const user = await requireUser();
  const clients = await listOAuthClients();
  return (
    <SettingsPage
      username={user.username}
      initialClients={clients.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        name: c.name,
        redirectUris: c.redirectUris,
        createdAt: c.createdAt,
      }))}
    />
  );
}
