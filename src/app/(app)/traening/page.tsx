import Link from "next/link";
import { Settings } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { countExercises } from "@/lib/workout";
import { TraeningListClient } from "./traening-list-client";

export const metadata = { title: "Træning | Loggen" };

export default async function TraeningPage() {
  const user = await requireUser();

  if (!user.trainingEnabled) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-8">
        <header className="mb-5 border-b border-hair pb-5">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Træning
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            Avanceret træningstracking er slået fra
          </h1>
        </header>
        <p className="text-[13px] text-mid">
          Med avanceret træningstracking kan du logge hele sessioner — øvelser,
          sæt, reps og noter — i stedet for kun at markere at du har trænet.
          Slå den til under indstillinger.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-flex items-center gap-2 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Settings className="size-4" />
          Gå til indstillinger
        </Link>
      </div>
    );
  }

  const workouts = await db
    .select()
    .from(schema.workouts)
    .where(eq(schema.workouts.userId, user.id))
    .orderBy(desc(schema.workouts.date), desc(schema.workouts.id));

  return (
    <TraeningListClient
      initialWorkouts={workouts.map((w) => ({
        id: w.id,
        title: w.title,
        date: w.date,
        durationMin: w.durationMin,
        exerciseCount: countExercises(w.body),
      }))}
    />
  );
}
