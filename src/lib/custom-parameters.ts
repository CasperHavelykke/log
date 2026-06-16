"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(schema.CUSTOM_PARAMETER_KINDS),
  unit: z.string().max(40).nullable().optional(),
});

export type CustomParamSummary = {
  id: number;
  name: string;
  kind: schema.CustomParameterKind;
  unit: string | null;
  archived: boolean;
  sortOrder: number;
};

export async function listCustomParameters(
  includeArchived = false,
): Promise<CustomParamSummary[]> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.customParameters)
    .where(
      includeArchived
        ? eq(schema.customParameters.userId, user.id)
        : and(
            eq(schema.customParameters.userId, user.id),
            eq(schema.customParameters.archived, false),
          ),
    )
    .orderBy(
      asc(schema.customParameters.sortOrder),
      asc(schema.customParameters.name),
    );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as schema.CustomParameterKind,
    unit: r.unit,
    archived: r.archived,
    sortOrder: r.sortOrder,
  }));
}

export async function createCustomParameter(
  input: z.infer<typeof createSchema>,
) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const inserted = await db
    .insert(schema.customParameters)
    .values({
      userId: user.id,
      name: parsed.data.name.trim(),
      kind: parsed.data.kind,
      unit: parsed.data.unit?.trim() || null,
    })
    .returning();
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/health");
  revalidatePath("/statistik");
  return { ok: true as const, parameter: inserted[0] };
}

const updateSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(120).optional(),
  unit: z.string().max(40).nullable().optional(),
  archived: z.boolean().optional(),
});

export async function updateCustomParameter(
  input: z.infer<typeof updateSchema>,
) {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const { id, ...changes } = parsed.data;
  const fields: Record<string, unknown> = {};
  if (changes.name !== undefined) fields.name = changes.name.trim();
  if (changes.unit !== undefined) fields.unit = changes.unit?.trim() || null;
  if (changes.archived !== undefined) fields.archived = changes.archived;
  if (Object.keys(fields).length === 0) return { ok: true as const };

  await db
    .update(schema.customParameters)
    .set(fields)
    .where(
      and(
        eq(schema.customParameters.id, id),
        eq(schema.customParameters.userId, user.id),
      ),
    );
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/health");
  revalidatePath("/statistik");
  return { ok: true as const };
}

export async function deleteCustomParameter(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.customParameters)
    .where(
      and(
        eq(schema.customParameters.id, id),
        eq(schema.customParameters.userId, user.id),
      ),
    );
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/health");
  revalidatePath("/statistik");
  return { ok: true as const };
}

// --- Værdier ---------------------------------------------------------------

const setValueSchema = z.object({
  parameterId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valueBool: z.boolean().nullable().optional(),
  valueInt: z.number().int().nullable().optional(),
  valueReal: z.number().nullable().optional(),
  valueText: z.string().max(10_000).nullable().optional(),
});

export type SetValueInput = z.infer<typeof setValueSchema>;

export async function setCustomParameterValue(input: SetValueInput) {
  const user = await requireUser();
  const parsed = setValueSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const data = parsed.data;

  // Verificér at parameter tilhører brugeren
  const pRows = await db
    .select()
    .from(schema.customParameters)
    .where(
      and(
        eq(schema.customParameters.id, data.parameterId),
        eq(schema.customParameters.userId, user.id),
      ),
    )
    .limit(1);
  if (!pRows[0]) return { ok: false as const, error: "Parameter findes ikke" };

  const allNull =
    (data.valueBool === null || data.valueBool === undefined) &&
    (data.valueInt === null || data.valueInt === undefined) &&
    (data.valueReal === null || data.valueReal === undefined) &&
    (data.valueText === null || data.valueText === undefined ||
      data.valueText === "");

  if (allNull) {
    // Slet eksisterende værdi for denne dato
    await db
      .delete(schema.customParameterValues)
      .where(
        and(
          eq(schema.customParameterValues.userId, user.id),
          eq(schema.customParameterValues.parameterId, data.parameterId),
          eq(schema.customParameterValues.date, data.date),
        ),
      );
  } else {
    const existing = await db
      .select()
      .from(schema.customParameterValues)
      .where(
        and(
          eq(schema.customParameterValues.userId, user.id),
          eq(schema.customParameterValues.parameterId, data.parameterId),
          eq(schema.customParameterValues.date, data.date),
        ),
      )
      .limit(1);

    const now = new Date().toISOString();
    const fields = {
      valueBool: data.valueBool ?? null,
      valueInt: data.valueInt ?? null,
      valueReal: data.valueReal ?? null,
      valueText: data.valueText?.trim() || null,
      updatedAt: now,
    };

    if (existing[0]) {
      await db
        .update(schema.customParameterValues)
        .set(fields)
        .where(eq(schema.customParameterValues.id, existing[0].id));
    } else {
      await db.insert(schema.customParameterValues).values({
        userId: user.id,
        parameterId: data.parameterId,
        date: data.date,
        ...fields,
      });
    }
  }

  revalidatePath("/today");
  revalidatePath("/health");
  revalidatePath("/statistik");
  return { ok: true as const };
}

export type CustomValueRow = {
  parameterId: number;
  valueBool: boolean | null;
  valueInt: number | null;
  valueReal: number | null;
  valueText: string | null;
};

export async function listCustomValuesForDate(
  date: string,
): Promise<CustomValueRow[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      parameterId: schema.customParameterValues.parameterId,
      valueBool: schema.customParameterValues.valueBool,
      valueInt: schema.customParameterValues.valueInt,
      valueReal: schema.customParameterValues.valueReal,
      valueText: schema.customParameterValues.valueText,
    })
    .from(schema.customParameterValues)
    .where(
      and(
        eq(schema.customParameterValues.userId, user.id),
        eq(schema.customParameterValues.date, date),
      ),
    );
  return rows;
}
