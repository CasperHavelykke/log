import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PublicRecipeView } from "@/components/public-recipe-view";
import { findCollectionOwner } from "@/lib/share";

// Opskrift åbnet via samlings-link: samlings-tokenet giver adgang til
// ejerens opskrifter — uafhængigt af opskriftens eget delelink.
export const dynamic = "force-dynamic";

type Params = Promise<{ token: string; id: string }>;

async function findRecipeInCollection(token: string, idStr: string) {
  const id = Number(idStr);
  if (!Number.isFinite(id)) return null;
  const owner = await findCollectionOwner(token);
  if (!owner) return null;
  const rows = await db
    .select()
    .from(schema.recipes)
    .where(and(eq(schema.recipes.id, id), eq(schema.recipes.userId, owner.id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token, id } = await params;
  const recipe = await findRecipeInCollection(token, id);
  if (!recipe) return { robots: { index: false, follow: false } };
  return {
    title: `${recipe.title} | Loggen`,
    robots: { index: false, follow: false },
    openGraph: {
      title: recipe.title,
      ...(recipe.imagePathname
        ? { images: [`/api/files/recipe/${recipe.id}?token=${token}`] }
        : {}),
    },
  };
}

export default async function SharedCollectionRecipePage({
  params,
}: {
  params: Params;
}) {
  const { token, id } = await params;
  const recipe = await findRecipeInCollection(token, id);
  if (!recipe) notFound();

  return (
    <PublicRecipeView
      recipe={{
        title: recipe.title,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        notes: recipe.notes,
        servings: recipe.servings,
        sourceUrl: recipe.sourceUrl,
        carbsG: recipe.carbsG,
        proteinG: recipe.proteinG,
        fatG: recipe.fatG,
        fiberG: recipe.fiberG,
      }}
      imageUrl={
        recipe.imagePathname
          ? `/api/files/recipe/${recipe.id}?token=${token}`
          : null
      }
      backHref={`/samling/${token}`}
    />
  );
}
