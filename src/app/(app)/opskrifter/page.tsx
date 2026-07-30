import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { RecipesListClient } from "./recipes-list-client";

export const metadata = { title: "Opskrifter | Loggen" };

export default async function RecipesPage() {
  const user = await requireUser();

  const recipes = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.userId, user.id))
    .orderBy(desc(schema.recipes.updatedAt));

  return (
    <RecipesListClient
      initialRecipes={recipes.map((r) => ({
        id: r.id,
        title: r.title,
        ingredients: r.ingredients,
        servings: r.servings,
        carbsG: r.carbsG,
        proteinG: r.proteinG,
        fatG: r.fatG,
        hasImage: r.imagePathname !== null,
        updatedAt: r.updatedAt,
      }))}
    />
  );
}
