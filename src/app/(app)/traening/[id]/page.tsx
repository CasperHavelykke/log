import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { WorkoutDetailClient } from "./workout-detail-client";

export const metadata = { title: "Træning | Loggen" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ rediger?: string }>;

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { id: idStr } = await params;
  const { rediger } = await searchParams;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const rows = await db
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, user.id)))
    .limit(1);
  const workout = rows[0];
  if (!workout) notFound();

  return (
    <WorkoutDetailClient
      workout={{
        id: workout.id,
        title: workout.title,
        date: workout.date,
        durationMin: workout.durationMin,
        body: workout.body,
        createdAt: workout.createdAt,
        updatedAt: workout.updatedAt,
      }}
      startInEdit={rediger === "1"}
    />
  );
}
