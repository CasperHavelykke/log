"use server";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { todayIsoDate } from "@/lib/date";

const TIME_OF_DAY_ENUM = z.enum(["morning", "midday", "evening", "night"]);

const newSupplementSchema = z.object({
  name: z.string().min(1).max(120),
  defaultDoseAmountX100: z.number().int().min(0).nullable().optional(),
  defaultDoseUnit: z.string().max(20).nullable().optional(),
  defaultTimeOfDay: TIME_OF_DAY_ENUM.nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
});

export async function createSupplement(input: z.infer<typeof newSupplementSchema>) {
  const user = await requireUser();
  const parsed = newSupplementSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { name, defaultDoseAmountX100, defaultDoseUnit, defaultTimeOfDay, notes } =
    parsed.data;

  // Dubletter er tilladt — du kan have flere "Lysin" med forskellige
  // standard-doser. Intakes er bundet via navnet, ikke template-id, så
  // sletning af et template-tilskud påvirker ikke historik.
  const inserted = await db
    .insert(schema.supplements)
    .values({
      userId: user.id,
      name: name.trim(),
      defaultDoseAmountX100: defaultDoseAmountX100 ?? null,
      defaultDoseUnit: defaultDoseUnit ?? null,
      defaultTimeOfDay: defaultTimeOfDay ?? null,
      notes: notes ?? null,
    })
    .returning();

  revalidatePath("/today");
  return { ok: true as const, supplement: inserted[0] };
}

const updateSupplementSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(120).optional(),
  defaultDoseAmountX100: z.number().int().min(0).nullable().optional(),
  defaultDoseUnit: z.string().max(20).nullable().optional(),
  defaultTimeOfDay: TIME_OF_DAY_ENUM.nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
  archived: z.boolean().optional(),
});

export async function updateSupplement(
  input: z.infer<typeof updateSupplementSchema>,
) {
  const user = await requireUser();
  const parsed = updateSupplementSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { id, ...changes } = parsed.data;

  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (v !== undefined) fields[k] = v;
  }
  if (Object.keys(fields).length === 0) return { ok: true as const };

  await db
    .update(schema.supplements)
    .set(fields)
    .where(
      and(
        eq(schema.supplements.id, id),
        eq(schema.supplements.userId, user.id),
      ),
    );

  revalidatePath("/today");
  return { ok: true as const };
}

export async function deleteSupplement(id: number) {
  const user = await requireUser();
  // Planer for tilskuddet slettes med — en tilskuds-plan uden tilskud kan
  // intet (ingen ét-kliks-logning, intet navn) og ville ellers stå
  // forældreløs uden UI til at fjerne den. Historiske intakes røres ikke.
  await db
    .delete(schema.planItems)
    .where(
      and(
        eq(schema.planItems.supplementId, id),
        eq(schema.planItems.userId, user.id),
      ),
    );
  await db
    .delete(schema.supplements)
    .where(
      and(
        eq(schema.supplements.id, id),
        eq(schema.supplements.userId, user.id),
      ),
    );
  revalidatePath("/today");
  return { ok: true as const };
}

const logIntakeSchema = z
  .object({
    supplementId: z.number().int().optional(),
    name: z.string().min(1).max(120).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    doseAmountX100: z.number().int().min(0).nullable().optional(),
    doseUnit: z.string().max(20).nullable().optional(),
    timeOfDay: TIME_OF_DAY_ENUM.nullable().optional(),
    note: z.string().max(2_000).nullable().optional(),
  })
  .refine((d) => d.supplementId !== undefined || (d.name && d.name.trim() !== ""), {
    message: "supplementId eller name kræves",
  });

export async function logSupplementIntake(
  input: z.infer<typeof logIntakeSchema>,
) {
  const user = await requireUser();
  const parsed = logIntakeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { supplementId, name, date, doseAmountX100, doseUnit, timeOfDay, note } =
    parsed.data;

  let resolvedName = name?.trim() ?? "";
  let resolvedDoseAmountX100: number | null = doseAmountX100 ?? null;
  let resolvedDoseUnit: string | null = doseUnit ?? null;
  let resolvedTimeOfDay: "morning" | "midday" | "evening" | "night" | null =
    timeOfDay ?? null;

  if (supplementId !== undefined) {
    const supplement = await db
      .select()
      .from(schema.supplements)
      .where(
        and(
          eq(schema.supplements.id, supplementId),
          eq(schema.supplements.userId, user.id),
        ),
      )
      .limit(1);
    if (!supplement[0]) {
      return { ok: false as const, error: "Tilskud findes ikke" };
    }
    const s = supplement[0];
    resolvedName = resolvedName || s.name;
    if (doseAmountX100 === undefined) resolvedDoseAmountX100 = s.defaultDoseAmountX100;
    if (doseUnit === undefined) resolvedDoseUnit = s.defaultDoseUnit;
    if (timeOfDay === undefined) {
      const t = s.defaultTimeOfDay;
      resolvedTimeOfDay =
        t === "morning" || t === "midday" || t === "evening" || t === "night"
          ? t
          : null;
    }
  }

  const inserted = await db
    .insert(schema.supplementIntakes)
    .values({
      userId: user.id,
      name: resolvedName,
      supplementId: supplementId ?? null,
      date: date ?? todayIsoDate(),
      doseAmountX100: resolvedDoseAmountX100,
      doseUnit: resolvedDoseUnit,
      timeOfDay: resolvedTimeOfDay,
      note: note ?? null,
    })
    .returning();

  revalidatePath("/today");
  return { ok: true as const, intake: inserted[0] };
}

export async function deleteSupplementIntake(id: number) {
  const user = await requireUser();
  await db
    .delete(schema.supplementIntakes)
    .where(
      and(
        eq(schema.supplementIntakes.id, id),
        eq(schema.supplementIntakes.userId, user.id),
      ),
    );
  revalidatePath("/today");
  return { ok: true as const };
}

const updateIntakeSchema = z.object({
  id: z.number().int(),
  doseAmountX100: z.number().int().min(0).nullable().optional(),
  doseUnit: z.string().max(20).nullable().optional(),
  timeOfDay: TIME_OF_DAY_ENUM.nullable().optional(),
  note: z.string().max(2_000).nullable().optional(),
});

export async function updateSupplementIntake(
  input: z.infer<typeof updateIntakeSchema>,
) {
  const user = await requireUser();
  const parsed = updateIntakeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt input" };
  const { id, ...changes } = parsed.data;
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (v !== undefined) fields[k] = v;
  }
  if (Object.keys(fields).length === 0) return { ok: true as const };

  await db
    .update(schema.supplementIntakes)
    .set(fields)
    .where(
      and(
        eq(schema.supplementIntakes.id, id),
        eq(schema.supplementIntakes.userId, user.id),
      ),
    );

  revalidatePath("/today");
  return { ok: true as const };
}
