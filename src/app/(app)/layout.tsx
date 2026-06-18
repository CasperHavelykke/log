import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/session";
import { listJobSearchPeriods } from "./jobs/period-actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  // Defensiv: hvis job_search_periods-tabellen ikke eksisterer endnu
  // (migration ikke kørt), så fald tilbage til at vise /jobs som vi
  // gjorde før. Forhindrer at hele appen crasher i deployment-vinduet.
  let showJobs = true;
  try {
    const periods = await listJobSearchPeriods();
    showJobs = periods.length > 0;
  } catch {
    showJobs = true;
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
