"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const workoutFieldsSchema = z.object({
  title: z.string().min(1, "Titel er påkrævet").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato"),
  durationMin: z.coerce.number().int().min(1).max(600).nullable(),
  body: z.string().max(20_000).default(""),
});

export type WorkoutInput = z.infer<typeof workoutFieldsSchema>;

async function getOwnWorkout(userId: number, id: number) {
  const rows = await db
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// Logget træning sætter didExercise på dagen — så håndvægt-ikonet på
// kalenderne og Træning-metrikken på /statistik følger med automatisk.
// Vi RYDDER aldrig flaget ved sletning: brugeren kan have sat det manuelt.
async function markDayExercised(userId: number, date: string) {
  const existing = await db
    .select({ id: schema.dayEntries.id, didExercise: schema.dayEntries.didExercise })
    .from(schema.dayEntries)
    .where(
      and(eq(schema.dayEntries.userId, userId), eq(schema.dayEntries.date, date)),
    )
    .limit(1);
  if (existing[0]) {
    if (!existing[0].didExercise) {
      await db
        .update(schema.dayEntries)
        .set({ didExercise: true, updatedAt: new Date().toISOString() })
        .where(eq(schema.dayEntries.id, existing[0].id));
    }
  } else {
    await db.insert(schema.dayEntries).values({
      userId,
      date,
      didExercise: true,
    });
  }
}

function revalidateWorkoutPaths(id?: number) {
  revalidatePath("/traening");
  if (id !== undefined) revalidatePath(`/traening/${id}`);
  revalidatePath("/today");
  revalidatePath("/health");
  revalidatePath("/statistik");
}

export async function createWorkout(input: WorkoutInput) {
  const user = await requireUser();
  const parsed = workoutFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const now = new Date().toISOString();
  const inserted = await db
    .insert(schema.workouts)
    .values({
      userId: user.id,
      title: parsed.data.title.trim(),
      date: parsed.data.date,
      durationMin: parsed.data.durationMin,
      body: parsed.data.body.trim(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await markDayExercised(user.id, parsed.data.date);
  revalidateWorkoutPaths();
  return { ok: true as const, workout: inserted[0] };
}

export async function updateWorkout(id: number, input: WorkoutInput) {
  const user = await requireUser();
  const parsed = workoutFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const workout = await getOwnWorkout(user.id, id);
  if (!workout) return { ok: false as const, error: "Træningen findes ikke" };

  await db
    .update(schema.workouts)
    .set({
      title: parsed.data.title.trim(),
      date: parsed.data.date,
      durationMin: parsed.data.durationMin,
      body: parsed.data.body.trim(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.workouts.id, id));
  await markDayExercised(user.id, parsed.data.date);
  revalidateWorkoutPaths(id);
  return { ok: true as const };
}

export async function deleteWorkout(id: number) {
  const user = await requireUser();
  const workout = await getOwnWorkout(user.id, id);
  if (!workout) return { ok: false as const, error: "Træningen findes ikke" };
  await db.delete(schema.workouts).where(eq(schema.workouts.id, id));
  revalidateWorkoutPaths();
  return { ok: true as const };
}

export async function listWorkouts() {
  const user = await requireUser();
  return db
    .select()
    .from(schema.workouts)
    .where(eq(schema.workouts.userId, user.id))
    .orderBy(desc(schema.workouts.date), desc(schema.workouts.id));
}

// --- Skabeloner -------------------------------------------------------------

export async function saveWorkoutAsTemplate(workoutId: number) {
  const user = await requireUser();
  const workout = await getOwnWorkout(user.id, workoutId);
  if (!workout) return { ok: false as const, error: "Træningen findes ikke" };

  const now = new Date().toISOString();
  // Upsert på titel (case-insensitivt): gemmer man samme program igen,
  // opdateres skabelonen i stedet for at lave en dublet.
  const existing = await db
    .select()
    .from(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.userId, user.id));
  const match = existing.find(
    (t) => t.title.trim().toLowerCase() === workout.title.trim().toLowerCase(),
  );

  if (match) {
    await db
      .update(schema.workoutTemplates)
      .set({
        durationMin: workout.durationMin,
        body: workout.body,
        updatedAt: now,
      })
      .where(eq(schema.workoutTemplates.id, match.id));
    revalidatePath("/traening");
    return { ok: true as const, updated: true, templateId: match.id };
  }

  const inserted = await db
    .insert(schema.workoutTemplates)
    .values({
      userId: user.id,
      title: workout.title.trim(),
      durationMin: workout.durationMin,
      body: workout.body,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  revalidatePath("/traening");
  return { ok: true as const, updated: false, templateId: inserted[0].id };
}

export async function deleteWorkoutTemplate(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, id),
        eq(schema.workoutTemplates.userId, user.id),
      ),
    );
  revalidatePath("/traening");
  return { ok: true as const };
}
