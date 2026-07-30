"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChefHat, Plus, Search, Users, X } from "lucide-react";
import { createRecipe } from "./actions";

type RecipeRow = {
  id: number;
  title: string;
  ingredients: string;
  servings: number | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  hasImage: boolean;
  updatedAt: string;
};

function kcalPerServing(r: {
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
}): number | null {
  if (r.carbsG === null || r.proteinG === null || r.fatG === null) return null;
  return r.carbsG * 4 + r.proteinG * 4 + r.fatG * 9;
}

export function RecipesListClient({
  initialRecipes,
}: {
  initialRecipes: RecipeRow[];
}) {
  const [recipes] = useState(initialRecipes);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.ingredients.toLowerCase().includes(q),
    );
  }, [recipes, query]);

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-hair pb-5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Opskrifter
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            {recipes.length === 0
              ? "Ingen opskrifter endnu"
              : `${recipes.length} gemt${recipes.length === 1 ? "" : "e"} opskrift${recipes.length === 1 ? "" : "er"}`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Ny opskrift
        </button>
      </header>

      <div className="mb-5 flex items-center gap-2 rounded-[10px] bg-bg-elevated px-3 py-2 shadow-[var(--shadow-card)]">
        <Search className="size-4 text-light" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg i titler og ingredienser…"
          className="!w-full !rounded-none !border-0 !bg-transparent !p-0 !text-[14px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="inline-flex cursor-pointer items-center rounded-[6px] p-1 text-dim hover:bg-bg hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-hair-strong px-6 py-12 text-center text-[13px] italic text-light">
          {recipes.length === 0
            ? "Gem din første opskrift — den er altid ved hånden bagefter."
            : "Ingen opskrifter matcher din søgning."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeRow }) {
  const kcal = kcalPerServing(recipe);
  const firstIngredients = recipe.ingredients
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "" && !s.endsWith(":"))
    .slice(0, 3)
    .join(" · ");

  return (
    <Link
      href={`/opskrifter/${recipe.id}`}
      className="group overflow-hidden rounded-[10px] bg-bg-elevated shadow-[var(--shadow-card)] transition-colors hover:bg-bg-subtle"
    >
      {recipe.hasImage ? (
        <div className="aspect-[2/1] w-full overflow-hidden bg-bg-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/recipe/${recipe.id}`}
            alt={recipe.title}
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[2/1] w-full items-center justify-center bg-bg-subtle">
          <ChefHat className="size-8 text-dim" />
        </div>
      )}
      <div className="p-3.5">
        <div className="font-serif text-[17px] leading-tight text-ink">
          {recipe.title}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-light">
          {recipe.servings !== null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {recipe.servings} pers.
            </span>
          )}
          {kcal !== null && <span>{kcal} kcal/portion</span>}
        </div>
        {firstIngredients && (
          <p className="mt-1.5 line-clamp-1 text-[12px] text-mid">
            {firstIngredients}
          </p>
        )}
      </div>
    </Link>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t) {
      setError("Giv opskriften en titel");
      return;
    }
    setError(null);
    start(async () => {
      const res = await createRecipe({
        title: t,
        ingredients: "",
        steps: "",
        notes: "",
        servings: null,
        sourceUrl: null,
        carbsG: null,
        proteinG: null,
        fatG: null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Videre til detaljesiden hvor resten udfyldes.
      router.push(`/opskrifter/${res.recipe.id}?rediger=1`);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="w-full max-w-[400px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Ny opskrift
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              Hvad hedder retten?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center rounded-[6px] p-1 text-dim hover:bg-bg hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="fx 'Kylling i karry'"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          className="!rounded-[8px] !border-hair !bg-bg-subtle"
        />
        <p className="mt-2 text-[11px] italic text-light">
          Ingredienser, fremgangsmåde og billede tilføjes på næste side.
        </p>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink disabled:opacity-50"
          >
            Annullér
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !title.trim()}
            className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            {pending ? "Opretter…" : "Opret og udfyld"}
          </button>
        </div>
      </div>
    </div>
  );
}
