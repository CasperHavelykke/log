import { requireUser } from "@/lib/session";
import { SettingsPage } from "./settings-page";

export const metadata = { title: "Indstillinger | Log" };

export default async function Settings() {
  const user = await requireUser();
  return <SettingsPage username={user.username} />;
}
