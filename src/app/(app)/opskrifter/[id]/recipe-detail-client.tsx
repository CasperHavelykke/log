"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  ChefHat,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/image-compress";
import {
  deleteRecipe,
  deleteRecipeImage,
  updateRecipe,
  uploadRecipeImage,
} from "../actions";

type RecipeData = {
  id: number;
  title: string;
  ingredients: string;
  steps: string;
  servings: number | null;
  sourceUrl: string | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  hasImage: boolean;
};

export function RecipeDetailClient({
  recipe: initial,
  startInEdit,
}: {
  recipe: RecipeData;
  startInEdit: boolean;
}) {
  const router = useRouter();
  const [recipe, setRecipe] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(startInEdit);
  const [imageVersion, setImageVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const kcal =
    recipe.carbsG !== null && recipe.proteinG !== null && recipe.fatG !== null
      ? recipe.carbsG * 4 + recipe.proteinG * 4 + recipe.fatG * 9
      : null;

  function startEditing() {
    setDraft(recipe);
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(recipe);
    setEditing(false);
    setError(null);
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updateRecipe(recipe.id, {
        title: draft.title,
        ingredients: draft.ingredients,
        steps: draft.steps,
        servings: draft.servings,
        sourceUrl: draft.sourceUrl,
        carbsG: draft.carbsG,
        proteinG: draft.proteinG,
        fatG: draft.fatG,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRecipe(draft);
      setEditing(false);
      router.refresh();
    });
  }

  async function onDelete() {
    if (!confirm(`Slet opskriften "${recipe.title}"? Kan ikke fortrydes.`)) {
      return;
    }
    const res = await deleteRecipe(recipe.id);
    if (res.ok) router.push("/opskrifter");
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <Link
          href="/opskrifter"
          className="inline-flex items-center gap-1.5 text-[13px] text-mid hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Opskrifter
        </Link>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] text-mid hover:bg-bg-elevated hover:text-ink disabled:opacity-50"
              >
                <X className="size-3.5" />
                Annullér
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
              >
                <Check className="size-3.5" strokeWidth={2.5} />
                {saving ? "Gemmer…" : "Gem"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] text-dim hover:bg-bg-elevated hover:text-danger"
              >
                <Trash2 className="size-3.5" />
                Slet
              </button>
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-bg-elevated px-3.5 py-1.5 text-[12px] text-mid hover:bg-bg-subtle hover:text-ink"
              >
                <Pencil className="size-3.5" />
                Rediger
              </button>
            </>
          )}
        </div>
      </div>

      <RecipeImage
        recipe={recipe}
        editing={editing}
        imageVersion={imageVersion}
        onChanged={(hasImage) => {
          setRecipe((r) => ({ ...r, hasImage }));
          setDraft((d) => ({ ...d, hasImage }));
          setImageVersion((v) => v + 1);
          router.refresh();
        }}
        onError={setError}
      />

      <header className="mb-5 border-b border-hair pb-5">
        {editing ? (
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="!rounded-[8px] !border-hair !bg-bg-subtle !font-serif !text-[22px]"
          />
        ) : (
          <h1 className="font-serif text-[26px] font-medium leading-[1.1] text-ink sm:text-[32px]">
            {recipe.title}
          </h1>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-light">
          {editing ? (
            <label className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <input
                type="text"
                inputMode="numeric"
                value={draft.servings === null ? "" : String(draft.servings)}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  if (t === "") return setDraft({ ...draft, servings: null });
                  const n = Number(t);
                  if (Number.isInteger(n) && n >= 1 && n <= 100) {
                    setDraft({ ...draft, servings: n });
                  }
                }}
                placeholder="4"
                className="!w-16 !rounded-[8px] !border-hair !bg-bg-subtle !py-1 !text-[13px]"
              />
              personer
            </label>
          ) : (
            recipe.servings !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {recipe.servings} personer
              </span>
            )
          )}
          {!editing && kcal !== null && <span>{kcal} kcal/portion</span>}
          {!editing && recipe.sourceUrl && (
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
        {editing && (
          <input
            type="url"
            value={draft.sourceUrl ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, sourceUrl: e.target.value || null })
            }
            placeholder="Link til original-opskrift (valgfrit)"
            className="mt-2 !rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
          />
        )}
      </header>

      {error && (
        <div className="mb-4 rounded-[10px] border border-danger/40 bg-[var(--danger-soft)] px-4 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.4fr] md:items-start">
        <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-3 border-b border-hair pb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Ingredienser
          </div>
          {editing ? (
            <textarea
              value={draft.ingredients}
              onChange={(e) =>
                setDraft({ ...draft, ingredients: e.target.value })
              }
              rows={10}
              placeholder={"400 g kyllingebryst\n1 dåse kokosmælk\n2 spsk karry"}
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[14px]"
            />
          ) : recipe.ingredients ? (
            <ul className="space-y-1.5">
              {recipe.ingredients
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-2 text-[14px] leading-snug text-ink"
                  >
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent" />
                    {line}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-[13px] italic text-light">
              Ingen ingredienser endnu.
            </p>
          )}
        </section>

        <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-3 border-b border-hair pb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Fremgangsmåde
          </div>
          {editing ? (
            <textarea
              value={draft.steps}
              onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
              rows={12}
              placeholder={"Brun kyllingen i gryden.\nTilsæt karry og rør rundt.\nHæld kokosmælken ved og lad det simre 15 min."}
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[14px]"
            />
          ) : recipe.steps ? (
            <ol className="space-y-2.5">
              {recipe.steps
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                    <span className="shrink-0 font-serif text-[14px] text-accent">
                      {i + 1}.
                    </span>
                    {line}
                  </li>
                ))}
            </ol>
          ) : (
            <p className="text-[13px] italic text-light">
              Ingen fremgangsmåde endnu.
            </p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="mb-3 flex items-baseline justify-between border-b border-hair pb-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Makroer per portion
          </span>
          <span className="text-[11px] italic text-dim">
            valgfrit — kun reference
          </span>
        </div>
        {editing ? (
          <div className="grid grid-cols-3 gap-3">
            <MacroField
              label="Kulhydrat"
              value={draft.carbsG}
              onChange={(n) => setDraft({ ...draft, carbsG: n })}
            />
            <MacroField
              label="Protein"
              value={draft.proteinG}
              onChange={(n) => setDraft({ ...draft, proteinG: n })}
            />
            <MacroField
              label="Fedt"
              value={draft.fatG}
              onChange={(n) => setDraft({ ...draft, fatG: n })}
            />
          </div>
        ) : kcal !== null ? (
          <div className="flex flex-wrap gap-2">
            <MacroPill label="Kulhydrat" value={recipe.carbsG!} />
            <MacroPill label="Protein" value={recipe.proteinG!} />
            <MacroPill label="Fedt" value={recipe.fatG!} />
            <span className="inline-flex items-center rounded-full bg-[var(--accent-bg)] px-2.5 py-1 text-[12px] font-medium text-accent">
              {kcal} kcal
            </span>
          </div>
        ) : (
          <p className="text-[13px] italic text-light">
            Ingen makroer angivet.
          </p>
        )}
      </section>
    </div>
  );
}

function MacroPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-2.5 py-1 text-[12px] text-mid">
      {label}
      <span className="font-medium text-ink">{value} g</span>
    </span>
  );
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value === null ? "" : String(value)}
          onChange={(e) => {
            const t = e.target.value.trim();
            if (t === "") return onChange(null);
            const n = Number(t);
            if (Number.isInteger(n) && n >= 0 && n <= 2000) onChange(n);
          }}
          placeholder="0"
          className="!rounded-[8px] !border-hair !bg-bg-subtle !pr-7"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-dim">
          g
        </span>
      </div>
    </div>
  );
}

function RecipeImage({
  recipe,
  editing,
  imageVersion,
  onChanged,
  onError,
}: {
  recipe: RecipeData;
  editing: boolean;
  imageVersion: number;
  onChanged: (hasImage: boolean) => void;
  onError: (e: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onPick(f: File | undefined) {
    if (!f) return;
    onError(null);
    if (!f.type.startsWith("image/")) {
      onError("Vælg en billed-fil");
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(f);
      const file = new File(
        [compressed.blob],
        f.name.replace(/\.[^.]+$/, ".jpg"),
        { type: "image/jpeg" },
      );
      const fd = new FormData();
      fd.append("file", file);
      fd.append("recipeId", String(recipe.id));
      const res = await uploadRecipeImage(fd);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onChanged(true);
    } catch (err) {
      onError(
        `Upload fejlede: ${err instanceof Error ? err.message : "ukendt"} (${formatFileSize(f.size)})`,
      );
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (!confirm("Fjern billedet fra opskriften?")) return;
    const res = await deleteRecipeImage(recipe.id);
    if (res.ok) onChanged(false);
  }

  if (!recipe.hasImage && !editing) return null;

  return (
    <div className="mb-5">
      {recipe.hasImage ? (
        <div className="relative overflow-hidden rounded-[10px] shadow-[var(--shadow-card)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/recipe/${recipe.id}?v=${imageVersion}`}
            alt={recipe.title}
            className="aspect-[2/1] w-full object-cover"
          />
          {editing && (
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-black/60 px-3 py-1.5 text-[12px] text-white backdrop-blur-sm hover:bg-black/75">
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                Skift
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPick(e.target.files?.[0])}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              <button
                type="button"
                onClick={removeImage}
                disabled={uploading}
                className="inline-flex cursor-pointer items-center rounded-[8px] bg-black/60 p-1.5 text-white backdrop-blur-sm hover:bg-black/75 hover:text-danger"
                title="Fjern billede"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-hair-strong">
          <ChefHat className="size-6 text-dim" />
          <div className="flex flex-wrap justify-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-bg-elevated px-3 py-1.5 text-[12px] text-mid hover:text-ink">
              <Camera className="size-3.5" />
              Tag billede
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPick(e.target.files?.[0])}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-bg-elevated px-3 py-1.5 text-[12px] text-mid hover:text-ink">
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              Fra bibliotek
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPick(e.target.files?.[0])}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
