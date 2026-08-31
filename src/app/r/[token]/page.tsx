import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicRecipeView } from "@/components/public-recipe-view";
import { findSharedRecipe } from "@/lib/share";

// Offentlig delelink-side — ingen auth, tokenet ER adgangen. Hemmelige
// links skal ikke i søgemaskiner.
export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const recipe = await findSharedRecipe(token);
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

export default async function SharedRecipePage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  const recipe = await findSharedRecipe(token);
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
    />
  );
}
