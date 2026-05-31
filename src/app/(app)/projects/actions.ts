"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const updateProjectSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(120).optional(),
  color: z.string().max(40).nullable().optional(),
  archived: z.boolean().optional(),
});

export async function updateProject(input: z.infer<typeof updateProjectSchema>) {
  const user = await requireUser();
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { id, ...changes } = parsed.data;

  const fields: Record<string, unknown> = {};
  if (changes.name !== undefined) fields.name = changes.name.trim();
  if (changes.color !== undefined) fields.color = changes.color;
  if (changes.archived !== undefined) fields.archived = changes.archived;
  if (Object.keys(fields).length === 0) return { ok: true as const };

  await db
    .update(schema.projects)
    .set(fields)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)));

  revalidatePath("/projects");
  revalidatePath("/today");
  return { ok: true as const };
}

export async function deleteProject(id: number) {
  const user = await requireUser();

  // Nulstil fokus-projekt hvis det er det der slettes.
  if (user.focusProjectId === id) {
    await db
      .update(schema.users)
      .set({ focusProjectId: null })
      .where(eq(schema.users.id, user.id));
  }

  await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)));

  revalidatePath("/projects");
  revalidatePath("/today");
  return { ok: true as const };
}

const timeEntrySchema = z.object({
  projectId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hoursX10: z.coerce.number().int().min(0).max(240),
  notes: z.string().max(10_000).nullable(),
});

export async function saveTimeEntry(input: z.infer<typeof timeEntrySchema>) {
  const user = await requireUser();
  const parsed = timeEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { projectId, date, hoursX10, notes } = parsed.data;

  const project = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)),
    )
    .limit(1);
  if (!project[0]) return { ok: false as const, error: "Projekt findes ikke" };

  const existing = await db
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        eq(schema.timeEntries.userId, user.id),
        eq(schema.timeEntries.projectId, projectId),
        eq(schema.timeEntries.date, date),
      ),
    )
    .limit(1);

  const cleanNotes = notes && notes.trim() !== "" ? notes : null;
  const now = new Date().toISOString();

  if (hoursX10 === 0) {
    if (existing[0]) {
      await db
        .delete(schema.timeEntries)
        .where(eq(schema.timeEntries.id, existing[0].id));
    }
    revalidatePath("/projects");
    revalidatePath("/today");
    return { ok: true as const, deleted: true, entry: null };
  }

  if (existing[0]) {
    const updated = await db
      .update(schema.timeEntries)
      .set({ hoursX10, notes: cleanNotes, updatedAt: now })
      .where(eq(schema.timeEntries.id, existing[0].id))
      .returning();
    revalidatePath("/projects");
    revalidatePath("/today");
    return { ok: true as const, deleted: false, entry: updated[0] };
  }

  const inserted = await db
    .insert(schema.timeEntries)
    .values({ userId: user.id, projectId, date, hoursX10, notes: cleanNotes })
    .returning();
  revalidatePath("/projects");
  revalidatePath("/today");
  return { ok: true as const, deleted: false, entry: inserted[0] };
}

export async function deleteTimeEntry(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.timeEntries)
    .where(
      and(eq(schema.timeEntries.id, id), eq(schema.timeEntries.userId, user.id)),
    );
  revalidatePath("/projects");
  revalidatePath("/today");
  return { ok: true as const };
}
