"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import { scaleLine } from "@/lib/recipe-scale";

export type PublicRecipe = {
  title: string;
  ingredients: string;
  steps: string;
  notes: string | null;
  servings: number | null;
  sourceUrl: string | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
};

// Læse-kun offentlig visning af en opskrift (delelink). Ingen auth, ingen
// redigering — men portions-stepperen virker, den er ren klient-tilstand.
export function PublicRecipeView({
  recipe,
  imageUrl,
  backHref,
}: {
  recipe: PublicRecipe;
  imageUrl: string | null;
  backHref?: string;
}) {
  const [viewServings, setViewServings] = useState(recipe.servings);

  const scaleFactor =
    recipe.servings !== null &&
    recipe.servings > 0 &&
    viewServings !== null &&
    viewServings !== recipe.servings
      ? viewServings / recipe.servings
      : 1;

  const kcal =
    recipe.carbsG !== null && recipe.proteinG !== null && recipe.fatG !== null
      ? recipe.carbsG * 4 + recipe.proteinG * 4 + recipe.fatG * 9
      : null;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      {backHref && (
        <div className="mb-5">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[13px] text-mid hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Alle opskrifter
          </Link>
        </div>
      )}

      {imageUrl && (
        <div className="mb-5 overflow-hidden rounded-[10px] bg-bg-subtle shadow-[var(--shadow-card)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={recipe.title}
            className="max-h-[320px] w-full object-cover"
          />
        </div>
      )}

      <header className="mb-5 border-b border-hair pb-5">
        <h1 className="font-serif text-[26px] font-medium leading-[1.1] text-ink sm:text-[32px]">
          {recipe.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-light">
          {recipe.servings !== null && (
            <span className="inline-flex items-center gap-1">
              <Users className="mr-0.5 size-3.5" />
              <button
                type="button"
                onClick={() =>
                  setViewServings(Math.max(1, (viewServings ?? 1) - 1))
                }
                disabled={(viewServings ?? 1) <= 1}
                aria-label="Færre personer"
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[8px] bg-bg-subtle text-[15px] text-mid hover:text-ink disabled:opacity-40 sm:size-6 sm:rounded-[6px] sm:text-[13px]"
              >
                −
              </button>
              <span className="min-w-[86px] text-center tabular-nums text-ink">
                {viewServings} person{(viewServings ?? 1) === 1 ? "" : "er"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setViewServings(Math.min(100, (viewServings ?? 1) + 1))
                }
                disabled={(viewServings ?? 1) >= 100}
                aria-label="Flere personer"
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[8px] bg-bg-subtle text-[15px] text-mid hover:text-ink disabled:opacity-40 sm:size-6 sm:rounded-[6px] sm:text-[13px]"
              >
                +
              </button>
              {scaleFactor !== 1 && (
                <button
                  type="button"
                  onClick={() => setViewServings(recipe.servings)}
                  className="ml-1 cursor-pointer text-[11px] italic text-accent hover:underline"
                >
                  nulstil
                </button>
              )}
            </span>
          )}
          {kcal !== null && <span>{kcal} kcal/portion</span>}
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <ExternalLink className="size-3" />
              Kilde
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.4fr] md:items-start">
        <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-3 flex items-baseline justify-between border-b border-hair pb-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              Ingredienser
            </span>
            {scaleFactor !== 1 && (
              <span className="text-[11px] italic text-accent">
                skaleret til {viewServings} pers.
              </span>
            )}
          </div>
          {recipe.ingredients ? (
            <ul className="space-y-1.5">
              {recipe.ingredients
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((line, i) =>
                  line.endsWith(":") ? (
                    <li
                      key={i}
                      className="pt-2 text-[11px] font-medium uppercase tracking-[0.5px] text-light first:pt-0"
                    >
                      {line.slice(0, -1)}
                    </li>
                  ) : (
                    <li
                      key={i}
                      className="flex items-baseline gap-2 text-[14px] leading-snug text-ink"
                    >
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent" />
                      {scaleLine(line, scaleFactor)}
                    </li>
                  ),
                )}
            </ul>
          ) : (
            <p className="text-[13px] italic text-light">Ingen ingredienser.</p>
          )}
        </section>

        <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-3 border-b border-hair pb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Fremgangsmåde
          </div>
          {recipe.steps ? (
            <ol className="space-y-2.5">
              {recipe.steps
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-[14px] leading-relaxed text-ink"
                  >
                    <span className="shrink-0 font-serif text-[14px] text-accent">
                      {i + 1}.
                    </span>
                    {line}
                  </li>
                ))}
            </ol>
          ) : (
            <p className="text-[13px] italic text-light">
              Ingen fremgangsmåde.
            </p>
          )}
        </section>
      </div>

      {recipe.notes && (
        <section className="mt-4 rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-3 border-b border-hair pb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Noter
          </div>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-mid">
            {recipe.notes}
          </p>
        </section>
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
