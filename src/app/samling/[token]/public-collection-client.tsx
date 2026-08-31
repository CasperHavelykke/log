"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChefHat, Search, Users, X } from "lucide-react";

type PublicRecipeRow = {
  id: number;
  title: string;
  ingredients: string;
  servings: number | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  fiberG: number | null;
  hasImage: boolean;
};

function kcalPerServing(r: {
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  fiberG: number | null;
}): number | null {
  if (r.carbsG === null || r.proteinG === null || r.fatG === null) return null;
  return r.carbsG * 4 + r.proteinG * 4 + r.fatG * 9 + (r.fiberG ?? 0) * 2;
}

export function PublicCollectionClient({
  token,
  recipes,
}: {
  token: string;
  recipes: PublicRecipeRow[];
}) {
  const [query, setQuery] = useState("");

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
      <header className="mb-5 border-b border-hair pb-5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
          Delt samling
        </div>
        <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
          {recipes.length} opskrift{recipes.length === 1 ? "" : "er"}
        </h1>
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
            ? "Ingen opskrifter i samlingen endnu."
            : "Ingen opskrifter matcher søgningen."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((r) => {
            const kcal = kcalPerServing(r);
            const firstIngredients = r.ingredients
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s !== "" && !s.endsWith(":"))
              .slice(0, 3)
              .join(" · ");
            return (
              <Link
                key={r.id}
                href={`/samling/${token}/${r.id}`}
                className="group overflow-hidden rounded-[10px] bg-bg-elevated shadow-[var(--shadow-card)] transition-colors hover:bg-bg-subtle"
              >
                {r.hasImage ? (
                  <div className="aspect-[2/1] w-full overflow-hidden bg-bg-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/recipe/${r.id}?token=${token}`}
                      alt={r.title}
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
                    {r.title}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-light">
                    {r.servings !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {r.servings} pers.
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
          })}
        </div>
      )}

      <footer className="mt-8 border-t border-hair pt-4 text-center text-[11px] text-dim">
        Delt via{" "}
        <a
          href="https://loggen.app"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Loggen
        </a>
      </footer>
    </div>
  );
}
