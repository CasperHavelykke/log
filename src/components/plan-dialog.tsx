"use client";

import { useState, useTransition } from "react";
import { Check, Pause, Play, Trash2, X } from "lucide-react";
import {
  deletePlanItem,
  setPlanItemPaused,
  upsertPlanItem,
  type PlanItemInput,
} from "@/app/(app)/today/plan-actions";
import { todayIsoDate } from "@/lib/date";
import type { PlanKind, PlanScheduleType } from "@/db/schema";
import type { PlanItemData } from "@/lib/plan";

export type { PlanItemData };

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

const INTERVAL_PRESETS: { label: string; days: number }[] = [
  { label: "Hver dag", days: 1 },
  { label: "Hver 2. dag", days: 2 },
  { label: "Hver 3. dag", days: 3 },
  { label: "Hver uge", days: 7 },
];

export function PlanDialog({
  label,
  title,
  kind,
  fixed,
  existing,
  templates,
  showMinutes = false,
  showLabel = false,
  showSupplementFields = false,
  nameSuggestions = [],
  showNutritionTargets = false,
  onChanged,
  onClose,
}: {
  label: string;
  title: string;
  kind: PlanKind;
  fixed?: {
    projectId?: number;
  };
  existing: PlanItemData | null;
  // training: vælg evt. skabelon som planen peger på.
  templates?: { id: number; title: string }[];
  showMinutes?: boolean;
  showLabel?: boolean;
  // supplement: navn (bindingen) + planens eget dosis-mål.
  showSupplementFields?: boolean;
  nameSuggestions?: string[];
  showNutritionTargets?: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [scheduleType, setScheduleType] = useState<PlanScheduleType>(
    existing?.scheduleType ?? "weekdays",
  );
  const [days, setDays] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const part of (existing?.weekdays ?? "").split(",")) {
      const n = Number(part);
      if (Number.isInteger(n) && n >= 0 && n <= 6) s.add(n);
    }
    return s;
  });
  const [intervalDays, setIntervalDays] = useState<number>(
    existing?.intervalDays ?? 2,
  );
  const [anchorDate, setAnchorDate] = useState<string>(
    existing?.anchorDate ?? todayIsoDate(),
  );
  const [timeOfDay, setTimeOfDay] = useState(existing?.timeOfDay ?? "");
  const [minutes, setMinutes] = useState<number | null>(
    existing?.minutesPlanned ?? null,
  );
  const [itemLabel, setItemLabel] = useState(existing?.label ?? "");
  const [doseTargetInput, setDoseTargetInput] = useState(
    existing?.doseTargetX100 == null
      ? ""
      : (existing.doseTargetX100 / 100).toString().replace(".", ","),
  );
  const [doseUnit, setDoseUnit] = useState(existing?.doseUnit ?? "");
  const [templateId, setTemplateId] = useState<number | null>(
    existing?.workoutTemplateId ?? null,
  );
  // Ernærings-mål som intervaller: min = "mindst", max = "højst", begge =
  // interval. Felter uden grænser tæller ikke med i auto-afkrydsningen.
  const [targets, setTargets] = useState<
    Record<NutritionField, { min: number | null; max: number | null }>
  >(() => ({
    kcal: { min: existing?.kcalTarget ?? null, max: existing?.kcalMax ?? null },
    carbs: {
      min: existing?.carbsTargetG ?? null,
      max: existing?.carbsMaxG ?? null,
    },
    protein: {
      min: existing?.proteinTargetG ?? null,
      max: existing?.proteinMaxG ?? null,
    },
    fat: { min: existing?.fatTargetG ?? null, max: existing?.fatMaxG ?? null },
    fiber: {
      min: existing?.fiberTargetG ?? null,
      max: existing?.fiberMaxG ?? null,
    },
  }));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function save() {
    setError(null);
    if (scheduleType === "weekdays" && days.size === 0) {
      setError("Vælg mindst én ugedag");
      return;
    }
    if (showLabel && !templateId && !itemLabel.trim()) {
      setError(kind === "meal" ? "Giv måltidet et navn" : "Giv planen et navn");
      return;
    }
    if (showSupplementFields && !itemLabel.trim()) {
      setError("Angiv tilskuddets navn");
      return;
    }
    // Dosis-mål: decimal med komma → ×100-heltal.
    let doseTargetX100: number | null = null;
    if (showSupplementFields && doseTargetInput.trim() !== "") {
      const n = Number(doseTargetInput.trim().replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setError("Ugyldigt dosis-mål");
        return;
      }
      doseTargetX100 = Math.round(n * 100);
    }
    if (
      showNutritionTargets &&
      Object.values(targets).some(
        (t) => t.min !== null && t.max !== null && t.max < t.min,
      )
    ) {
      setError("'Højst' skal være mindst lig 'mindst'");
      return;
    }
    const input: PlanItemInput = {
      id: existing?.id,
      kind,
      projectId: fixed?.projectId ?? null,
      supplementId: null,
      workoutTemplateId: templateId,
      label: itemLabel.trim() || null,
      scheduleType,
      weekdays:
        scheduleType === "weekdays"
          ? [...days].sort((a, b) => a - b).join(",")
          : null,
      intervalDays: scheduleType === "interval" ? intervalDays : null,
      anchorDate: scheduleType === "weekdays" ? null : anchorDate,
      timeOfDay: timeOfDay.trim() || null,
      minutesPlanned: minutes,
      doseTargetX100,
      doseUnit: doseUnit.trim() || null,
      kcalTarget: targets.kcal.min,
      kcalMax: targets.kcal.max,
      carbsTargetG: targets.carbs.min,
      carbsMaxG: targets.carbs.max,
      proteinTargetG: targets.protein.min,
      proteinMaxG: targets.protein.max,
      fatTargetG: targets.fat.min,
      fatMaxG: targets.fat.max,
      fiberTargetG: targets.fiber.min,
      fiberMaxG: targets.fiber.max,
    };
    start(async () => {
      const res = await upsertPlanItem(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onChanged();
      onClose();
    });
  }

  function remove() {
    if (!existing) return;
    if (!confirm("Slet planen? Historikken røres ikke.")) return;
    start(async () => {
      await deletePlanItem(existing.id);
      onChanged();
      onClose();
    });
  }

  function togglePaused() {
    if (!existing) return;
    start(async () => {
      await setPlanItemPaused(existing.id, !existing.paused);
      onChanged();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-[14px] bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
              {label}
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              {title}
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

        {showLabel && (
          <div className="mb-4">
            <FieldLabel>
              {kind === "meal" ? "Måltid" : "Navn"}
            </FieldLabel>
            <input
              type="text"
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              placeholder={
                kind === "meal"
                  ? "fx 'Frokost: kylling i karry'"
                  : "fx 'Styrketræning'"
              }
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
            />
          </div>
        )}

        {showSupplementFields && (
          <div className="mb-4 space-y-3">
            <div>
              <FieldLabel>Tilskud (navn)</FieldLabel>
              <input
                type="text"
                value={itemLabel}
                onChange={(e) => setItemLabel(e.target.value)}
                placeholder="fx 'Glycin'"
                list="plan-supplement-names"
                className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
              />
              <datalist id="plan-supplement-names">
                {nameSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] italic text-light">
                Alle dagens indtag med dette navn tæller — uanset hvilken
                genvej (eller AI) der loggede dem.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Dosis-mål (valgfrit)</FieldLabel>
                <input
                  type="text"
                  inputMode="decimal"
                  value={doseTargetInput}
                  onChange={(e) => setDoseTargetInput(e.target.value)}
                  placeholder="fx 12"
                  className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
                />
              </div>
              <div>
                <FieldLabel>Enhed</FieldLabel>
                <input
                  type="text"
                  value={doseUnit}
                  onChange={(e) => setDoseUnit(e.target.value)}
                  placeholder="mg / g / μg"
                  className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
                />
              </div>
            </div>
            <p className="text-[11px] italic text-light">
              Med mål krydses planen først af, når dagens sum når dosen —
              uden mål tæller ét indtag.
            </p>
          </div>
        )}

        {templates !== undefined && templates.length > 0 && (
          <div className="mb-4">
            <FieldLabel>Skabelon (valgfri)</FieldLabel>
            <select
              value={templateId === null ? "" : String(templateId)}
              onChange={(e) =>
                setTemplateId(e.target.value === "" ? null : Number(e.target.value))
              }
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
            >
              <option value="">— Ingen (kun navn) —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] italic text-light">
              Med skabelon starter et klik på Dagens plan en forudfyldt session.
            </p>
          </div>
        )}

        {/* Gentagelse */}
        <FieldLabel>Gentagelse</FieldLabel>
        <div className="mb-3 inline-flex gap-0.5 rounded-[8px] bg-bg p-0.5">
          {(
            [
              ["weekdays", "Ugedage"],
              ["interval", "Interval"],
              ["monthly", "Månedligt"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScheduleType(value)}
              className={`cursor-pointer rounded-[6px] px-3 py-1.5 text-[12px] transition ${
                scheduleType === value
                  ? "bg-accent font-medium text-white"
                  : "text-mid hover:text-ink"
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        {scheduleType === "weekdays" && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={days.has(i)}
                className={`min-h-[40px] min-w-[44px] cursor-pointer rounded-[8px] px-2 text-[12px] transition ${
                  days.has(i)
                    ? "bg-accent font-medium text-white"
                    : "bg-bg-subtle text-mid hover:text-ink"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        )}

        {scheduleType === "interval" && (
          <div className="mb-4 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {INTERVAL_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setIntervalDays(p.days)}
                  className={`min-h-[40px] cursor-pointer rounded-[8px] px-3 text-[12px] transition ${
                    intervalDays === p.days
                      ? "bg-accent font-medium text-white"
                      : "bg-bg-subtle text-mid hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-mid">
              Hver
              <input
                type="text"
                inputMode="numeric"
                value={String(intervalDays)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  if (Number.isInteger(n) && n >= 1 && n <= 365) {
                    setIntervalDays(n);
                  }
                }}
                className="!w-16 !rounded-[8px] !border-hair !bg-bg-subtle !py-1.5 !text-center !text-[13px]"
              />
              . dag fra
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="!w-auto min-w-0 !rounded-[8px] !border-hair !bg-bg-subtle !py-1.5 !text-[13px]"
              />
            </div>
            <p className="text-[11px] italic text-light">
              Fast rytme: en misset dag flytter ikke de næste.
            </p>
          </div>
        )}

        {scheduleType === "monthly" && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-[13px] text-mid">
              Månedligt fra
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="!w-auto min-w-0 !rounded-[8px] !border-hair !bg-bg-subtle !py-1.5 !text-[13px]"
              />
            </div>
            <p className="text-[11px] italic text-light">
              Gentages på samme dag i måneden (d. 31 bliver månedens sidste
              dag i korte måneder).
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Tidspunkt (valgfri)</FieldLabel>
            <input
              type="text"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              placeholder="fx 'formiddag'"
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
            />
          </div>
          {showMinutes && (
            <div>
              <FieldLabel>Planlagt tid (min)</FieldLabel>
              <input
                type="text"
                inputMode="numeric"
                value={minutes === null ? "" : String(minutes)}
                onChange={(e) => {
                  const t = e.target.value.replace(/\D/g, "");
                  setMinutes(t === "" ? null : Math.min(1440, Number(t)));
                }}
                placeholder="fx 120"
                className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
              />
            </div>
          )}
        </div>

        {showNutritionTargets && (
          <div className="mt-4">
            <FieldLabel>Mål for dagen</FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <RangeInput field="kcal" label="Kcal" cap={10_000} targets={targets} setTargets={setTargets} />
              <RangeInput field="carbs" label="Kulhydrat (g)" cap={2000} targets={targets} setTargets={setTargets} />
              <RangeInput field="fiber" label="+ Fibre (g)" cap={200} targets={targets} setTargets={setTargets} />
              <RangeInput field="protein" label="Protein (g)" cap={1000} targets={targets} setTargets={setTargets} />
              <RangeInput field="fat" label="Fedt (g)" cap={1000} targets={targets} setTargets={setTargets} />
            </div>
            <p className="mt-2 text-[11px] italic text-light">
              Kun &apos;mindst&apos; = gulv, kun &apos;højst&apos; = loft,
              begge = interval. Krydses af når alle udfyldte mål er
              overholdt — uanset tidspunkt på dagen.
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hair pt-4">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            <Check className="size-3.5" strokeWidth={2.5} />
            {pending ? "Gemmer…" : "Gem plan"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-[40px] cursor-pointer rounded-[8px] px-3 py-2 text-[13px] text-mid hover:text-ink disabled:opacity-50"
          >
            Annullér
          </button>
          <div className="flex-1" />
          {existing && (
            <>
              <button
                type="button"
                onClick={togglePaused}
                disabled={pending}
                title={existing.paused ? "Genoptag planen" : "Sæt planen på pause"}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[12px] text-dim hover:bg-bg hover:text-ink disabled:opacity-50"
              >
                {existing.paused ? (
                  <>
                    <Play className="size-3.5" />
                    Genoptag
                  </>
                ) : (
                  <>
                    <Pause className="size-3.5" />
                    Pause
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                title="Slet planen"
                className="inline-flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-[8px] p-2 text-dim hover:bg-bg hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
      {children}
    </label>
  );
}

type NutritionField = "kcal" | "carbs" | "protein" | "fat" | "fiber";
type NutritionTargets = Record<
  NutritionField,
  { min: number | null; max: number | null }
>;

// Ét interval-felt: to inputs (mindst/højst) — begge valgfrie.
function RangeInput({
  field,
  label,
  cap,
  targets,
  setTargets,
}: {
  field: NutritionField;
  label: string;
  cap: number;
  targets: NutritionTargets;
  setTargets: React.Dispatch<React.SetStateAction<NutritionTargets>>;
}) {
  const t = targets[field];
  function set(bound: "min" | "max", raw: string) {
    const digits = raw.replace(/\D/g, "");
    const n = digits === "" ? null : Math.min(cap, Number(digits));
    setTargets((prev) => ({
      ...prev,
      [field]: { ...prev[field], [bound]: n },
    }));
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={t.min === null ? "" : String(t.min)}
          onChange={(e) => set("min", e.target.value)}
          placeholder="mindst"
          aria-label={`${label} — mindst`}
          className="!min-w-0 !rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
        />
        <span className="shrink-0 text-[12px] text-light">–</span>
        <input
          type="text"
          inputMode="numeric"
          value={t.max === null ? "" : String(t.max)}
          onChange={(e) => set("max", e.target.value)}
          placeholder="højst"
          aria-label={`${label} — højst`}
          className="!min-w-0 !rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
        />
      </div>
    </div>
  );
}
