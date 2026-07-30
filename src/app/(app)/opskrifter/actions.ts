"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import {
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
  deleteBlob,
  uploadBlob,
} from "@/lib/blob";

const RECIPE_PREFIX = "recipes";

const recipeFieldsSchema = z.object({
  title: z.string().min(1, "Titel er påkrævet").max(200),
  ingredients: z.string().max(10_000).default(""),
  steps: z.string().max(20_000).default(""),
  servings: z.coerce.number().int().min(1).max(100).nullable(),
  sourceUrl: z.string().max(1000).nullable(),
  carbsG: z.coerce.number().int().min(0).max(2000).nullable(),
  proteinG: z.coerce.number().int().min(0).max(2000).nullable(),
  fatG: z.coerce.number().int().min(0).max(2000).nullable(),
});

export type RecipeInput = z.infer<typeof recipeFieldsSchema>;

async function getOwnRecipe(userId: number, id: number) {
  const rows = await db
    .select()
    .from(schema.recipes)
    .where(and(eq(schema.recipes.id, id), eq(schema.recipes.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRecipes() {
  const user = await requireUser();
  return db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.userId, user.id))
    .orderBy(desc(schema.recipes.updatedAt));
}

export async function createRecipe(input: RecipeInput) {
  const user = await requireUser();
  const parsed = recipeFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const now = new Date().toISOString();
  const inserted = await db
    .insert(schema.recipes)
    .values({
      userId: user.id,
      title: parsed.data.title.trim(),
      ingredients: parsed.data.ingredients.trim(),
      steps: parsed.data.steps.trim(),
      servings: parsed.data.servings,
      sourceUrl: parsed.data.sourceUrl?.trim() || null,
      carbsG: parsed.data.carbsG,
      proteinG: parsed.data.proteinG,
      fatG: parsed.data.fatG,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  revalidatePath("/opskrifter");
  return { ok: true as const, recipe: inserted[0] };
}

export async function updateRecipe(id: number, input: RecipeInput) {
  const user = await requireUser();
  const parsed = recipeFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Ugyldigt input",
    };
  }
  const recipe = await getOwnRecipe(user.id, id);
  if (!recipe) return { ok: false as const, error: "Opskriften findes ikke" };

  await db
    .update(schema.recipes)
    .set({
      title: parsed.data.title.trim(),
      ingredients: parsed.data.ingredients.trim(),
      steps: parsed.data.steps.trim(),
      servings: parsed.data.servings,
      sourceUrl: parsed.data.sourceUrl?.trim() || null,
      carbsG: parsed.data.carbsG,
      proteinG: parsed.data.proteinG,
      fatG: parsed.data.fatG,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.recipes.id, id));
  revalidatePath("/opskrifter");
  revalidatePath(`/opskrifter/${id}`);
  return { ok: true as const };
}

export async function deleteRecipe(id: number) {
  const user = await requireUser();
  const recipe = await getOwnRecipe(user.id, id);
  if (!recipe) return { ok: false as const, error: "Opskriften findes ikke" };

  if (recipe.imagePathname) {
    await deleteBlob(recipe.imagePathname);
  }
  await db.delete(schema.recipes).where(eq(schema.recipes.id, id));
  revalidatePath("/opskrifter");
  return { ok: true as const };
}

export async function uploadRecipeImage(formData: FormData) {
  const user = await requireUser();

  const idRaw = formData.get("recipeId");
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "Ugyldigt opskrift-id" };
  }
  const recipe = await getOwnRecipe(user.id, id);
  if (!recipe) return { ok: false as const, error: "Opskriften findes ikke" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Vælg en fil" };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false as const,
      error: `For stor (${Math.round(file.size / 1024 / 1024)} MB > 5 MB)`,
    };
  }
  if (!PHOTO_MIME_TYPES.includes(file.type)) {
    return {
      ok: false as const,
      error: `Ikke understøttet format: ${file.type}`,
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadBlob({
    data: buf,
    prefix: `${RECIPE_PREFIX}/${user.id}`,
    filename: file.name,
    contentType: file.type,
  });

  // Ryd evt. gammelt billede op — én fil per opskrift.
  if (recipe.imagePathname) {
    await deleteBlob(recipe.imagePathname);
  }

  await db
    .update(schema.recipes)
    .set({
      imagePathname: uploaded.pathname,
      imageMime: file.type,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.recipes.id, id));

  revalidatePath("/opskrifter");
  revalidatePath(`/opskrifter/${id}`);
  return { ok: true as const };
}

export async function deleteRecipeImage(id: number) {
  const user = await requireUser();
  const recipe = await getOwnRecipe(user.id, id);
  if (!recipe) return { ok: false as const, error: "Opskriften findes ikke" };

  if (recipe.imagePathname) {
    await deleteBlob(recipe.imagePathname);
  }
  await db
    .update(schema.recipes)
    .set({
      imagePathname: null,
      imageMime: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.recipes.id, id));

  revalidatePath("/opskrifter");
  revalidatePath(`/opskrifter/${id}`);
  return { ok: true as const };
}
