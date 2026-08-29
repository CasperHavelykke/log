import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { findCollectionOwner } from "@/lib/share";
import { PublicCollectionClient } from "./public-collection-client";

// Offentligt samlings-link — ingen auth, tokenet ER adgangen.
export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const owner = await findCollectionOwner(token);
  return {
    title: owner ? "Opskrifter | Loggen" : "Loggen",
    robots: { index: false, follow: false },
  };
}

export default async function SharedCollectionPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  const owner = await findCollectionOwner(token);
  if (!owner) notFound();

  const recipes = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.userId, owner.id))
    .orderBy(desc(schema.recipes.updatedAt));

  return (
    <PublicCollectionClient
      token={token}
      recipes={recipes.map((r) => ({
        id: r.id,
        title: r.title,
        ingredients: r.ingredients,
        servings: r.servings,
        carbsG: r.carbsG,
        proteinG: r.proteinG,
        fatG: r.fatG,
        hasImage: r.imagePathname !== null,
      }))}
    />
  );
}
