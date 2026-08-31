import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

function shapeRecipeSummary(row: typeof schema.recipes.$inferSelect) {
  const kcal =
    row.carbsG !== null && row.proteinG !== null && row.fatG !== null
      ? row.carbsG * 4 +
        row.proteinG * 4 +
        row.fatG * 9 +
        (row.fiberG ?? 0) * 2
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
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    fiberG: row.fiberG,
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
    .describe(
      "Én ingrediens per linje. Start linjen med mængde + enhed ('400 g kyllingebryst', '1,5 dl fløde', '1/2 løg') — det ledende tal bruges til automatisk portions-skalering i UI, så skriv ALDRIG mængden inde i teksten ('kyllingebryst, 400 g' skalerer ikke). Decimaler med komma. En linje der ender med kolon ('Til dressingen:', 'Evt:') bliver en under-overskrift uden bullet.",
    ),
  steps: z
    .string()
    .max(20_000)
    .default("")
    .describe(
      "Ét trin per linje UDEN manuel nummerering ('1.', '2.' osv.) — UI nummererer selv, så manuel nummerering giver dobbelt-numre. KUN selve fremgangsmåden — tips, holdbarhed og makro-forklaringer hører til i notes.",
    ),
  notes: z
    .string()
    .max(10_000)
    .default("")
    .describe(
      "Fri-tekst noter (tips, holdbarhed, variationer). Vises som afsnit, ikke nummererede trin.",
    ),
  servings: z
    .number()
    .int()
    .min(1)
    .max(100)
    .nullable()
    .default(null)
    .describe(
      "Antal portioner ingredienser-mængderne svarer til. Sæt den altid når den kendes — uden den kan UI ikke skalere portioner.",
    ),
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
  fiberG: z
    .number()
    .int()
    .min(0)
    .max(200)
    .nullable()
    .default(null)
    .describe(
      "Kostfibre i gram PER PORTION. SEPARAT fra carbsG — EU-varedeklarationer angiver kulhydrat EKSKL. fibre. Fibre tæller 2 kcal/g i kcal/portion.",
    ),
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
        "Gemmer en ny opskrift i brugerens samling. Følg felternes formatregler nøje (linjebaseret format med skalerbar mængde-parsing) — se beskrivelsen på hvert felt. Makroer er per portion og valgfrie.",
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
          notes: input.notes.trim() || null,
          servings: input.servings,
          sourceUrl: input.sourceUrl?.trim() || null,
          carbsG: input.carbsG,
          proteinG: input.proteinG,
          fatG: input.fatG,
          fiberG: input.fiberG,
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
        ingredients: z
          .string()
          .max(10_000)
          .optional()
          .describe(
            "Samme format som create_recipe: én per linje, ledende mængde+enhed (skalerbar), ':'-suffix = under-overskrift.",
          ),
        steps: z
          .string()
          .max(20_000)
          .optional()
          .describe(
            "Samme format som create_recipe: ét trin per linje uden manuel nummerering.",
          ),
        notes: z.string().max(10_000).optional(),
        servings: z.number().int().min(1).max(100).nullable().optional(),
        sourceUrl: z.string().max(1000).nullable().optional(),
        carbsG: z.number().int().min(0).max(2000).nullable().optional(),
        proteinG: z.number().int().min(0).max(2000).nullable().optional(),
        fatG: z.number().int().min(0).max(2000).nullable().optional(),
        fiberG: z.number().int().min(0).max(200).nullable().optional(),
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
          notes:
            patch.notes !== undefined
              ? patch.notes.trim() || null
              : recipe.notes,
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
          fiberG: patch.fiberG !== undefined ? patch.fiberG : recipe.fiberG,
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
