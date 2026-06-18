import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/session";
import { getActiveJobSearchPeriod } from "./jobs/period-actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  // Nav viser /jobs kun når der er en aktiv periode. Historiske perioder
  // tilgås via /settings → Jobsøgning. Defensiv catch for tilfælde hvor
  // tabellen endnu ikke eksisterer.
  let showJobs = false;
  try {
    const active = await getActiveJobSearchPeriod();
    showJobs = active !== null;
  } catch {
    showJobs = false;
  }
  return (
    <div className="flex min-h-screen flex-col">
      <Nav showJobs={showJobs} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
