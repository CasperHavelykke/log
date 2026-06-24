import { cookies } from "next/headers";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { requireUser } from "@/lib/session";
import { listJobSearchPeriods } from "./jobs/period-actions";
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

  let jobsPlacement: "primary" | "archive" | "hidden" = "hidden";
  try {
    const periods = await listJobSearchPeriods();
    const hasActive = periods.some((p) => p.endedAt === null);
    jobsPlacement = hasActive
      ? "primary"
      : periods.length > 0
        ? "archive"
        : "hidden";
  } catch {
    jobsPlacement = "hidden";
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav jobsPlacement={jobsPlacement} email={user.email ?? null} />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-32 pt-[calc(env(safe-area-inset-top,0px)+16px)] sm:pb-8 sm:pt-[calc(env(safe-area-inset-top,0px)+32px)] md:px-10 md:pb-10">
        {children}
      </main>
      <MobileNav jobsPlacement={jobsPlacement} />
      {drinkSession && (
        <FloatingCounterBanner totalUnits={drinkSession.totalUnits} />
      )}
    </div>
  );
}
