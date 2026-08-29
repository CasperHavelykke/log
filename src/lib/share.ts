import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";

// Token-opslag til offentlige delelinks. Tokenet ER adgangen — hemmeligt,
// ugætteligt (CSPRNG, base64url) og kan trækkes tilbage ved at sætte
// feltet til null.

export async function findSharedRecipe(token: string) {
  if (!token || token.length > 64) return null;
  const rows = await db
    .select()
    .from(schema.recipes)
    .where(
      and(
        eq(schema.recipes.shareToken, token),
        isNotNull(schema.recipes.shareToken),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findCollectionOwner(token: string) {
  if (!token || token.length > 64) return null;
  const rows = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.recipesShareToken, token),
        isNotNull(schema.users.recipesShareToken),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
