"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { saveDayEntry } from "../today/actions";
import { EscapeButton } from "./cholesterol-shell";
import type { CholesterolData, Range } from "./data";
import { InfoDialog } from "./info-dialog";
import type { InfoField } from "./info";
import { danishWeekday, formatDanishDate } from "@/lib/date";

const fmtInt = (n: number) => n.toLocaleString("da-DK");
const fmtKg = (n: number) =>
  n.toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function TodayView({
  data,
  onEscape,
}: {
  data: CholesterolData;
  onEscape: () => void;
}) {
  const { intake, targets, today } = data;
  const nothingLogged =
    intake.kcal === null &&
    intake.carbsG === null &&
    intake.fatG === null &&
    intake.proteinG === null &&
    intake.alcoholUnits === null;
  const kcalRange = targets?.kcal ?? null;
  const [info, setInfo] = useState<InfoField | null>(null);

  // Værdi og mål pr. felt — bruges af både bjælkerne og info-dialogen.
  const fields: Record<InfoField, { value: number | null; range: Range | null }> = {
    saturatedFat: { value: intake.saturatedFatG, range: targets?.saturatedFat ?? null },
    fiber: { value: intake.fiberG, range: targets?.fiber ?? null },
    kcal: { value: intake.kcal, range: kcalRange },
    carbs: { value: intake.carbsG, range: targets?.carbs ?? null },
    fat: { value: intake.fatG, range: targets?.fat ?? null },
    protein: { value: intake.proteinG, range: targets?.protein ?? null },
    alcohol: { value: intake.alcoholUnits, range: null },
  };

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] text-mid">
            {capitalize(formatDanishDate(today))}
          </div>
          <h1 className="font-serif text-[28px] leading-tight text-ink">
            Dagens indtag
          </h1>
        </div>
        <EscapeButton onClick={onEscape} />
      </header>

      {nothingLogged && (
        <p className="mb-4 rounded-[10px] bg-bg-elevated px-4 py-3 text-[14px] text-mid">
          Intet logget endnu i dag. Fortæl din AI, hvad du har spist.
        </p>
      )}

      {/* De tre greb mod kolesterol, i vigtighedsorden: mættet fedt, fibre,
          kalorier. Store bjælker. */}
      <section className="space-y-4 rounded-[12px] bg-bg-elevated p-4 shadow-[var(--shadow-card)]">
        <PrimaryField label="Mættet fedt" unit="g" {...fields.saturatedFat} onInfo={() => setInfo("saturatedFat")} />
        <PrimaryField label="Fibre" unit="g" {...fields.fiber} onInfo={() => setInfo("fiber")} />
        <PrimaryField label="Kalorier" {...fields.kcal} onInfo={() => setInfo("kcal")} />
      </section>

      {/* Resten: ekstra optimering, små bjælker. */}
      <section className="mt-3 rounded-[12px] bg-bg-elevated p-4 shadow-[var(--shadow-card)]">
        <IntakeRow label="Kulhydrat" {...fields.carbs} onInfo={() => setInfo("carbs")} />
        <IntakeRow label="Fedt" {...fields.fat} onInfo={() => setInfo("fat")} />
        <IntakeRow label="Protein" {...fields.protein} onInfo={() => setInfo("protein")} />

        {/* Genstande har intet mål og ingen bjælke — kun tallet og kalorierne. */}
        <button
          type="button"
          onClick={() => setInfo("alcohol")}
          className="mt-3 flex w-full cursor-pointer items-center gap-3 border-t border-hair pt-3 text-left"
        >
          <span className="inline-flex w-[96px] shrink-0 items-center gap-1 text-[13px] text-mid">
            Genstande
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[18px] font-semibold tabular-nums text-ink">
              {intake.alcoholUnits === null ? "–" : fmtInt(intake.alcoholUnits)}
            </span>
            {intake.drinkKcal > 0 && (
              <span className="text-[13px] text-mid">· {fmtInt(intake.drinkKcal)} kcal</span>
            )}
          </span>
        </button>
      </section>

      <WeightRow data={data} />

      {info && (
        <InfoDialog
          field={info}
          value={fields[info].value}
          range={fields[info].range}
          intake={intake}
          onClose={() => setInfo(null)}
        />
      )}
    </div>
  );
}

// Stort felt: navn med info-ikon over en stor bjælke. Hele feltet er trykbart.
function PrimaryField({
  label,
  unit,
  value,
  range,
  onInfo,
}: {
  label: string;
  unit?: string;
  value: number | null;
  range: Range | null;
  onInfo: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onInfo}
      className="block w-full cursor-pointer text-left"
      aria-label={`${label}: vis info`}
    >
      <span className="mb-2 inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink">
        {label}
      </span>
      <IntakeBar value={value} range={range} size="lg" unit={unit} />
    </button>
  );
}

function IntakeRow({
  label,
  value,
  range,
  onInfo,
}: {
  label: string;
  value: number | null;
  range: Range | null;
  onInfo: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onInfo}
      className="mt-2 flex w-full cursor-pointer items-center gap-3 text-left first:mt-0"
      aria-label={`${label}: vis info`}
    >
      <span className="inline-flex w-[96px] shrink-0 items-center gap-1 text-[13px] text-mid">
        {label}
      </span>
      <span className="block min-w-0 flex-1">
        <IntakeBar value={value} range={range} size="sm" unit="g" />
      </span>
    </button>
  );
}

// Fyldningen op til dagens værdi: mørk grå bund med diagonale striber,
// tallet i baggrundsfarven (hvidt i lyst tema, mørkt i mørkt). Fyldningen
// er mindst så bred, at tallet altid står på den.
const STRIPES =
  "repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink) 18%, transparent) 0 3px, transparent 3px 9px)";
const MIN_FILL_PX = { lg: 112, md: 84, sm: 68 } as const;

// Én bjælke: grå fyldning op til dagens værdi, lysegrøn zone for målet,
// gult for det der er over loftet.
function IntakeBar({
  value,
  range,
  size,
  unit = "",
}: {
  value: number | null;
  range: Range | null;
  size: "lg" | "md" | "sm";
  unit?: string;
}) {
  const min = range?.min ?? null;
  const max = range?.max ?? null;
  const hasZone = min !== null || max !== null;
  // Skala: lidt forbi det største af zone og værdi, så intet klistrer i kanten.
  const scaleEnd = Math.max(min ?? 0, max ?? 0, value ?? 0, 1) * 1.15;
  const pct = (v: number) => Math.min(100, Math.max(0, (v / scaleEnd) * 100));
  const over = max !== null && value !== null && value > max;
  const fillEnd = value ?? 0;
  // Hvor i fyldningen loftet ligger (procent af fyldningens egen bredde).
  const overStartPct = over ? (max! / value!) * 100 : 0;

  const height = size === "lg" ? "h-14" : size === "md" ? "h-10" : "h-8";
  const text =
    size === "lg" ? "text-[26px]" : size === "md" ? "text-[16px]" : "text-[14px]";

  return (
    <div
      className={`relative ${height} overflow-hidden rounded-[10px]`}
      // Sporet: et nøk lysere end kortet i begge temaer, så det tomme
      // stykke kan ses (bg-subtle forsvinder næsten i mørkt tema).
      style={{ backgroundColor: "color-mix(in srgb, var(--ink) 14%, var(--bg-elevated))" }}
      role="img"
      aria-label={
        value === null
          ? "Ikke logget"
          : `${fmtInt(value)}${unit ? " " + unit : ""}${over ? ", over loftet" : ""}`
      }
    >
      {hasZone && (
        <div
          className="absolute inset-y-0 bg-success-strong"
          style={{
            left: `${pct(min ?? 0)}%`,
            width: `${pct(max ?? scaleEnd) - pct(min ?? 0)}%`,
          }}
        />
      )}
      {value !== null && (
        <div
          className="absolute inset-y-0 left-0 rounded-r-[10px]"
          style={{
            width: `max(${pct(fillEnd)}%, ${MIN_FILL_PX[size]}px)`,
            // Gennemsigtig grå, så zonen bagved stadig kan ses. Det gule
            // (over loftet) er en del af samme element, så kanten er én
            // form uden hak — et lag i gradienten, ikke en ekstra boks.
            backgroundColor: "color-mix(in srgb, var(--mid) 65%, transparent)",
            backgroundImage: over
              ? `linear-gradient(to right, transparent ${overStartPct}%, color-mix(in srgb, var(--warning) 75%, transparent) ${overStartPct}%), ${STRIPES}`
              : STRIPES,
          }}
        />
      )}
      <div
        className={`absolute inset-y-0 left-3 flex items-center font-semibold tabular-nums ${text} ${
          value === null ? "text-light" : "text-bg"
        }`}
      >
        {value === null ? "–" : fmtInt(value)}
        {value !== null && unit && (
          <span className={`ml-1 font-normal ${size === "lg" ? "text-[14px]" : "text-[12px]"}`}>
            {unit}
          </span>
        )}
      </div>
      {over && (
        <TriangleAlert
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-warning ${size === "lg" ? "size-6" : "size-5"}`}
          aria-hidden
        />
      )}
    </div>
  );
}

function weightMeta(data: CholesterolData): string {
  const { deltaKg, latestDate } = data.weight;
  if (deltaKg !== null) {
    if (deltaKg === 0) return "Uændret på 4 uger";
    return `${deltaKg < 0 ? "Ned" : "Op"} ${fmtKg(Math.abs(deltaKg))} kg på 4 uger`;
  }
  if (latestDate === null) return "Ingen vejning endnu";
  if (latestDate === data.today) return "Vejet i dag";
  return `Vejet ${danishWeekday(latestDate)}`;
}

// Vægt: én linje, tryk åbner en lille dialog. AI'en er den primære vej
// ind, så feltet er der, men råber ikke.
function WeightRow({ data }: { data: CholesterolData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full cursor-pointer items-center gap-3 rounded-[12px] bg-bg-elevated p-4 text-left shadow-[var(--shadow-card)] hover:bg-bg-subtle"
      >
        <span className="w-[104px] shrink-0 text-[15px] font-semibold text-ink">Vægt</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-mid">{weightMeta(data)}</span>
        <span className="shrink-0 text-[20px] font-semibold tabular-nums text-ink">
          {data.weight.latestKg === null ? "–" : `${fmtKg(data.weight.latestKg)} kg`}
        </span>
      </button>
      {open && <WeightDialog data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function WeightDialog({
  data,
  onClose,
}: {
  data: CholesterolData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState(
    data.weight.latestKg === null ? "" : fmtKg(data.weight.latestKg),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    const n = Number(input.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 500) {
      setError("Skriv vægten i kg, fx 84,2");
      return;
    }
    start(async () => {
      const res = await saveDayEntry({ date: data.today, weightX10: Math.round(n * 10) });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weight-dialog-title"
        className="w-full max-w-[360px] rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="weight-dialog-title" className="mb-4 font-serif text-[20px] leading-none text-ink">
          Vægt i dag
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="84,2"
            autoFocus
            className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[22px]"
            aria-label="Vægt i kg"
          />
          <span className="text-[16px] text-mid">kg</span>
        </div>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 cursor-pointer rounded-[8px] px-4 text-[14px] text-mid hover:text-ink"
          >
            Annullér
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-5 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Gem
          </button>
        </div>
      </div>
    </div>
  );
}
