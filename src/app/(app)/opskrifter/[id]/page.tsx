import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { RecipeDetailClient } from "./recipe-detail-client";

export const metadata = { title: "Opskrift | Loggen" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ rediger?: string }>;

export default async function RecipeDetailPage({
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
    .from(schema.recipes)
    .where(and(eq(schema.recipes.id, id), eq(schema.recipes.userId, user.id)))
    .limit(1);
  const recipe = rows[0];
  if (!recipe) notFound();

  return (
    <RecipeDetailClient
      recipe={{
        id: recipe.id,
        title: recipe.title,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        notes: recipe.notes ?? "",
        servings: recipe.servings,
        sourceUrl: recipe.sourceUrl,
        carbsG: recipe.carbsG,
        proteinG: recipe.proteinG,
        fatG: recipe.fatG,
        hasImage: recipe.imagePathname !== null,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
      }}
      startInEdit={rediger === "1"}
    />
  );
}
