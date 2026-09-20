import { cookies } from "next/headers";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { IdleBlur } from "@/components/idle-blur";
import { isDemoMode } from "@/lib/demo";
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
  const counterMode = user.counterModeEnabled ?? false;
  // Tælleren overtager skærmen ved aktiv session — og i genstandstæller-
  // tilstand også imellem sessioner (startskærm). "Til appen"-flugtvejen
  // (escape-cookien) gælder begge dele.
  if (drinkSession || counterMode) {
    const cookieStore = await cookies();
    const escaped = cookieStore.get(ESCAPE_COOKIE)?.value === "1";
    if (!escaped) {
      return (
        <CounterWrapper initial={drinkSession} counterMode={counterMode} />
      );
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
      <Nav
        jobsPlacement={jobsPlacement}
        trainingEnabled={user.trainingEnabled ?? false}
        email={user.email ?? null}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {isDemoMode() && (
          <div className="sticky top-0 z-40 border-b border-[var(--accent-soft-strong)] bg-[var(--accent-bg)] px-4 py-1.5 pt-[calc(env(safe-area-inset-top,0px)+6px)] text-center text-[12px] text-accent backdrop-blur-sm">
            Demo — kig frit rundt, alt data er fiktivt og nulstilles
            automatisk.{" "}
            <a
              href="https://loggen.app/login"
              className="font-medium underline underline-offset-2 hover:text-accent-bright"
            >
              Opret din egen gratis →
            </a>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-32 pt-[calc(env(safe-area-inset-top,0px)+16px)] sm:pb-8 sm:pt-[calc(env(safe-area-inset-top,0px)+32px)] md:px-10 md:pb-10">
          {children}
        </main>
      </div>
      <MobileNav
        jobsPlacement={jobsPlacement}
        trainingEnabled={user.trainingEnabled ?? false}
      />
      {(drinkSession || counterMode) && (
        <FloatingCounterBanner
          totalUnitsX10={drinkSession?.totalUnitsX10 ?? null}
        />
      )}
      <IdleBlur />
    </div>
  );
}
