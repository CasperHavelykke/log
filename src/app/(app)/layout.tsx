import { cookies } from "next/headers";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { requireUser } from "@/lib/session";
import { getActiveJobSearchPeriod } from "./jobs/period-actions";
import { getActiveSession } from "./drink-counter/actions";
import {
  CounterWrapper,
  FloatingCounterBanner,
} from "./drink-counter/counter-wrapper";

const ESCAPE_COOKIE = "drink-counter-escape";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const drinkSession = await getActiveSession();
  if (drinkSession) {
    const cookieStore = await cookies();
    const escaped = cookieStore.get(ESCAPE_COOKIE)?.value === "1";
    if (!escaped) {
      return <CounterWrapper initial={drinkSession} />;
    }
  }

  let showJobs = false;
  try {
    const active = await getActiveJobSearchPeriod();
    showJobs = active !== null;
  } catch {
    showJobs = false;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav showJobs={showJobs} email={user.email ?? null} />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-32 pt-4 sm:py-8 md:px-10 md:pb-10">
        {children}
      </main>
      <MobileNav showJobs={showJobs} />
      {drinkSession && (
        <FloatingCounterBanner totalUnits={drinkSession.totalUnits} />
      )}
    </div>
  );
}
