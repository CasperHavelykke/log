"use client";

import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import type { Range, TodayIntake } from "./data";
import { FIELD_INFO, type InfoField } from "./info";

const fmtInt = (n: number) => n.toLocaleString("da-DK");

function targetText(range: Range | null, unit: string): string | null {
  if (!range || (range.min === null && range.max === null)) return null;
  const u = unit ? ` ${unit}` : "";
  if (range.min !== null && range.max !== null)
    return `${fmtInt(range.min)}–${fmtInt(range.max)}${u}`;
  if (range.min !== null) return `mindst ${fmtInt(range.min)}${u}`;
  return `højst ${fmtInt(range.max!)}${u}`;
}

function statusText(
  value: number | null,
  range: Range | null,
  unit: string,
): string | null {
  if (value === null || !range) return null;
  const u = unit ? ` ${unit}` : "";
  if (range.max !== null && value > range.max)
    return `Du er ${fmtInt(value - range.max)}${u} over loftet.`;
  if (range.min !== null && value < range.min)
    return `Du mangler ${fmtInt(range.min - value)}${u} for at nå minimum.`;
  if (range.min !== null || range.max !== null) return "Du er inden for målet.";
  return null;
}

function timeOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

// Info om ét felt: tallet, målet, hvordan bjælken læses, hvorfor det
// betyder noget for kolesterol, og kilderne. Lukkes ved tryk udenfor.
export function InfoDialog({
  field,
  value,
  range,
  intake,
  onClose,
}: {
  field: InfoField;
  value: number | null;
  range: Range | null;
  intake: TodayIntake;
  onClose: () => void;
}) {
  const info = FIELD_INFO[field];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const target = targetText(range, info.unit);
  const status = statusText(value, range, info.unit);
  // Grøn betyder noget forskelligt alt efter målet — skriv det ud, så
  // forklaringen passer til det, man ser. Kalorier: vedligehold.
  const targetHeading = field === "kcal" ? "Dit vedligehold" : "Dit mål";
  const greenLabel =
    field === "kcal"
      ? "Grøn: dit vedligehold, hvor vægten holder sig"
      : !range || (range.min === null && range.max === null)
        ? "Grøn: dit mål (ikke sat endnu)"
        : range.min !== null && range.max !== null
          ? "Grøn: inden for dit mål"
          : range.max !== null
            ? "Grøn: under dit loft"
            : "Grøn: over dit minimum";
  const updated = timeOf(intake.updatedAt);

  // Ekstra linjer der kun giver mening for bestemte felter.
  const extras: string[] = [];
  if (field === "kcal" && intake.drinkKcal > 0 && intake.alcoholUnits) {
    extras.push(
      `Heraf ${fmtInt(intake.drinkKcal)} kcal fra ${fmtInt(intake.alcoholUnits)} ${intake.alcoholUnits === 1 ? "genstand" : "genstande"}.`,
    );
  }
  if (field === "kcal" && value === null && intake.drinkKcal === 0) {
    extras.push("Vises først, når kulhydrat, protein og fedt alle er logget.");
  }
  if (field === "saturatedFat" && value !== null && intake.fatG) {
    extras.push(
      `Det er ${Math.round((value / intake.fatG) * 100)} % af dagens fedt (${fmtInt(intake.fatG)} g).`,
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-dialog-title"
        className="max-h-[88vh] w-full max-w-[440px] overflow-y-auto rounded-[14px] bg-bg-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="info-dialog-title" className="font-serif text-[22px] leading-none text-ink">
              {info.title}
            </h2>
            <div className="mt-2 text-[28px] font-semibold leading-none tabular-nums text-ink">
              {value === null ? "–" : fmtInt(value)}
              {value !== null && info.unit && (
                <span className="ml-1 text-[15px] font-normal text-mid">{info.unit}</span>
              )}
            </div>
            {updated && (
              <div className="mt-1 text-[12px] text-light">Sidst logget kl. {updated}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk"
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-light hover:bg-bg-subtle hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        {field !== "alcohol" && (
          <section className="rounded-[10px] bg-bg-subtle px-3.5 py-3 text-[14px]">
            <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              {targetHeading}
            </div>
            {target ? (
              <>
                <div className="mt-0.5 font-semibold text-ink">{target}</div>
                {status && <div className="mt-0.5 text-mid">{status}</div>}
              </>
            ) : (
              <div className="mt-0.5 text-mid">
                Intet mål sat endnu. Bed din AI om at sætte et, fx{" "}
                <em>&quot;sæt mit loft for {info.title.toLowerCase()} til …&quot;</em>.
              </div>
            )}
          </section>
        )}

        {extras.length > 0 && (
          <ul className="mt-3 space-y-1 text-[14px] text-mid">
            {extras.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[14px] text-mid">{info.what}</p>

        {field !== "alcohol" && (
          <ul className="mt-3 space-y-1 text-[12px] text-light">
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-[3px] bg-mid opacity-70" /> Grå: det du har fået i dag
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-[3px] bg-success-strong" /> {greenLabel}
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-[3px] bg-warning opacity-80" /> Gul: over loftet
            </li>
          </ul>
        )}

        <h3 className="mt-5 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Hvorfor det betyder noget
        </h3>
        <p className="mt-1 text-[14px] leading-relaxed text-ink">{info.why}</p>

        <h3 className="mt-4 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Kilder
        </h3>
        <ul className="mt-1 space-y-1.5">
          {info.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 text-[13px] text-accent hover:underline"
              >
                <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
