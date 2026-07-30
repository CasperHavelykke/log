import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

function shapeRecipeSummary(row: typeof schema.recipes.$inferSelect) {
  const kcal =
    row.carbsG !== null && row.proteinG !== null && row.fatG !== null
      ? row.carbsG * 4 + row.proteinG * 4 + row.fatG * 9
      : null;
  return {
    id: row.id,
    title: row.title,
    servings: row.servings,
    kcalPerServing: kcal,
    hasImage: row.imagePathname !== null,
    updatedAt: row.updatedAt,
  };
}

function shapeRecipeFull(row: typeof schema.recipes.$inferSelect) {
  return {
    ...shapeRecipeSummary(row),
    ingredients: row.ingredients,
    steps: row.steps,
    sourceUrl: row.sourceUrl,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    createdAt: row.createdAt,
  };
}

async function getOwnRecipe(userId: number, id: number) {
  const rows = await db
    .select()
    .from(schema.recipes)
    .where(and(eq(schema.recipes.id, id), eq(schema.recipes.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

const recipeInputShape = {
  title: z.string().min(1).max(200),
  ingredients: z
    .string()
    .max(10_000)
    .default("")
    .describe("Én ingrediens per linje, fx '400 g kyllingebryst'."),
  steps: z
    .string()
    .max(20_000)
    .default("")
    .describe("Ét trin per linje. Nummerering tilføjes automatisk i UI."),
  servings: z.number().int().min(1).max(100).nullable().default(null),
  sourceUrl: z.string().max(1000).nullable().default(null),
  carbsG: z
    .number()
    .int()
    .min(0)
    .max(2000)
    .nullable()
    .default(null)
    .describe("Kulhydrater i gram PER PORTION (valgfri reference)."),
  proteinG: z.number().int().min(0).max(2000).nullable().default(null),
  fatG: z.number().int().min(0).max(2000).nullable().default(null),
};

export function registerRecipeTools(server: McpServer) {
  server.registerTool(
    "list_recipes",
    {
      title: "List opskrifter",
      description:
        "Returnerer brugerens gemte opskrifter (titel, portioner, kcal/portion). Brug query til fritekst-søgning i titel + ingredienser — fx til 'hvad kan jeg lave med kylling?'.",
      inputSchema: {
        query: z
          .string()
          .max(200)
          .optional()
          .describe("Fritekst-søgning i titel og ingredienser."),
        limit: z.number().int().min(1).max(200).default(50),
      },
    },
    async ({ query, limit }) => {
      const user = await getActiveUser();
      const conditions = [eq(schema.recipes.userId, user.id)];
      if (query && query.trim() !== "") {
        const q = `%${query.trim()}%`;
        conditions.push(
          or(
            like(schema.recipes.title, q),
            like(schema.recipes.ingredients, q),
          )!,
        );
      }
      const rows = await db
        .select()
        .from(schema.recipes)
        .where(and(...conditions))
        .orderBy(desc(schema.recipes.updatedAt))
        .limit(limit);
      return jsonContent({
        count: rows.length,
        recipes: rows.map(shapeRecipeSummary),
      });
    },
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Hent opskrift",
      description:
        "Returnerer den fulde opskrift: ingrediensliste, fremgangsmåde, makroer per portion og kilde-link.",
      inputSchema: {
        id: z.number().int(),
      },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const recipe = await getOwnRecipe(user.id, id);
      if (!recipe) return errorContent("Opskriften findes ikke");
      return jsonContent({ recipe: shapeRecipeFull(recipe) });
    },
  );

  server.registerTool(
    "create_recipe",
    {
      title: "Gem ny opskrift",
      description:
        "Gemmer en ny opskrift i brugerens samling. Ingredienser: én per linje. Fremgangsmåde: ét trin per linje. Makroer er per portion og valgfrie.",
      inputSchema: recipeInputShape,
    },
    async (input) => {
      const user = await getActiveUser();
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.recipes)
        .values({
          userId: user.id,
          title: input.title.trim(),
          ingredients: input.ingredients.trim(),
          steps: input.steps.trim(),
          servings: input.servings,
          sourceUrl: input.sourceUrl?.trim() || null,
          carbsG: input.carbsG,
          proteinG: input.proteinG,
          fatG: input.fatG,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return jsonContent({
        ok: true,
        recipe: shapeRecipeFull(inserted[0]),
      });
    },
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Opdatér opskrift",
      description:
        "Opdaterer felter på en eksisterende opskrift. Udeladte felter røres ikke. Send tom streng for at rydde tekstfelter, null for at rydde tal-felter.",
      inputSchema: {
        id: z.number().int(),
        title: z.string().min(1).max(200).optional(),
        ingredients: z.string().max(10_000).optional(),
        steps: z.string().max(20_000).optional(),
        servings: z.number().int().min(1).max(100).nullable().optional(),
        sourceUrl: z.string().max(1000).nullable().optional(),
        carbsG: z.number().int().min(0).max(2000).nullable().optional(),
        proteinG: z.number().int().min(0).max(2000).nullable().optional(),
        fatG: z.number().int().min(0).max(2000).nullable().optional(),
      },
    },
    async ({ id, ...patch }) => {
      const user = await getActiveUser();
      const recipe = await getOwnRecipe(user.id, id);
      if (!recipe) return errorContent("Opskriften findes ikke");

      await db
        .update(schema.recipes)
        .set({
          title: patch.title !== undefined ? patch.title.trim() : recipe.title,
          ingredients:
            patch.ingredients !== undefined
              ? patch.ingredients.trim()
              : recipe.ingredients,
          steps: patch.steps !== undefined ? patch.steps.trim() : recipe.steps,
          servings:
            patch.servings !== undefined ? patch.servings : recipe.servings,
          sourceUrl:
            patch.sourceUrl !== undefined
              ? patch.sourceUrl?.trim() || null
              : recipe.sourceUrl,
          carbsG: patch.carbsG !== undefined ? patch.carbsG : recipe.carbsG,
          proteinG:
            patch.proteinG !== undefined ? patch.proteinG : recipe.proteinG,
          fatG: patch.fatG !== undefined ? patch.fatG : recipe.fatG,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.recipes.id, id));

      const updated = await getOwnRecipe(user.id, id);
      return jsonContent({ ok: true, recipe: shapeRecipeFull(updated!) });
    },
  );

  server.registerTool(
    "delete_recipe",
    {
      title: "Slet opskrift",
      description:
        "Sletter en opskrift permanent (inkl. evt. billede). Kan ikke fortrydes — bekræft med brugeren først.",
      inputSchema: {
        id: z.number().int(),
      },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const recipe = await getOwnRecipe(user.id, id);
      if (!recipe) return errorContent("Opskriften findes ikke");
      // Billed-fil ryddes op via samme sti som web-UI's deleteRecipe.
      if (recipe.imagePathname) {
        const { deleteBlob } = await import("../../lib/blob");
        await deleteBlob(recipe.imagePathname);
      }
      await db.delete(schema.recipes).where(eq(schema.recipes.id, id));
      return jsonContent({ ok: true, deletedId: id });
    },
  );
}
