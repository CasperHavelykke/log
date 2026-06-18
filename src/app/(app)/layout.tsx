import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/session";
import { listJobSearchPeriods } from "./jobs/period-actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const periods = await listJobSearchPeriods();
  return (
    <div className="flex min-h-screen flex-col">
      <Nav showJobs={periods.length > 0} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
