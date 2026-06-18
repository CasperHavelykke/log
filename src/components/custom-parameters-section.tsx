"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  setCustomParameterValue,
  type CustomParamSummary,
  type CustomValueRow,
} from "@/lib/custom-parameters";

type ValueState = {
  valueBool: boolean | null;
  valueInt: number | null;
  valueReal: number | null;
  valueText: string | null;
};

const emptyValue: ValueState = {
  valueBool: null,
  valueInt: null,
  valueReal: null,
  valueText: null,
};

export function CustomParametersSection({
  parameters,
  date,
  initialValues,
}: {
  parameters: CustomParamSummary[];
  date: string;
  initialValues: CustomValueRow[];
}) {
  const initialMap = new Map<number, ValueState>(
    initialValues.map((v) => [
      v.parameterId,
      {
        valueBool: v.valueBool,
        valueInt: v.valueInt,
        valueReal: v.valueReal,
        valueText: v.valueText,
      },
    ]),
  );

  const [values, setValues] = useState<Map<number, ValueState>>(initialMap);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [savedAt, setSavedAt] = useState<Map<number, number>>(new Map());

  function getValue(paramId: number): ValueState {
    return values.get(paramId) ?? emptyValue;
  }

  function persist(paramId: number, next: ValueState) {
    setValues((prev) => {
      const m = new Map(prev);
      m.set(paramId, next);
      return m;
    });
    setSaving((prev) => new Set(prev).add(paramId));

    setCustomParameterValue({
      parameterId: paramId,
      date,
      valueBool: next.valueBool,
      valueInt: next.valueInt,
      valueReal: next.valueReal,
      valueText: next.valueText,
    }).finally(() => {
      setSaving((prev) => {
        const s = new Set(prev);
        s.delete(paramId);
        return s;
      });
      setSavedAt((prev) => {
        const m = new Map(prev);
        m.set(paramId, Date.now());
        return m;
      });
    });
  }

  if (parameters.length === 0) return null;

  return (
    <div className="space-y-1">
      {parameters.map((p) => (
        <ParameterRow
          key={p.id}
          parameter={p}
          value={getValue(p.id)}
          saving={saving.has(p.id)}
          savedRecently={
            savedAt.get(p.id) !== undefined &&
            Date.now() - (savedAt.get(p.id) ?? 0) < 2000
          }
          onChange={(next) => persist(p.id, next)}
        />
      ))}
    </div>
  );
}

function ParameterRow({
  parameter,
  value,
  saving,
  savedRecently,
  onChange,
}: {
  parameter: CustomParamSummary;
  value: ValueState;
  saving: boolean;
  savedRecently: boolean;
  onChange: (next: ValueState) => void;
}) {
  // For "text" type the input takes full width below the label.
  // For other types the controls sit to the right of the label.
  const isText = parameter.kind === "text";
  const isBoolScale =
    parameter.kind === "bool_scale_5" || parameter.kind === "bool_scale_10";

  if (isText) {
    return (
      <div className="py-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label className="text-[13px] text-ink">
            {parameter.name}
            {parameter.unit && (
              <span className="ml-1 text-[10px] text-dim">
                · {parameter.unit}
              </span>
            )}
          </label>
          <SaveIndicator saving={saving} saved={savedRecently} />
        </div>
        <TextInput
          value={value.valueText}
          onChange={(v) => onChange({ ...emptyValue, valueText: v })}
        />
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <label className="flex items-center gap-2 text-[14px] text-ink sm:text-[13px]">
          {parameter.name}
          {parameter.unit && (
            <span className="text-[11px] text-dim sm:text-[10px]">· {parameter.unit}</span>
          )}
          <SaveIndicator saving={saving} saved={savedRecently} />
        </label>
        <div className="self-stretch sm:self-auto">
          {renderControls(parameter, value, onChange)}
        </div>
      </div>
      {isBoolScale && value.valueBool === true && (
        <div className="mt-2 sm:ml-3 sm:mt-1">
          <ScaleButtons
            max={parameter.kind === "bool_scale_5" ? 5 : 10}
            value={value.valueInt}
            onChange={(v) =>
              onChange({ ...emptyValue, valueBool: true, valueInt: v })
            }
          />
        </div>
      )}
    </div>
  );
}

function renderControls(
  parameter: CustomParamSummary,
  value: ValueState,
  onChange: (next: ValueState) => void,
) {
  switch (parameter.kind) {
    case "boolean":
      return (
        <YesNoButtons
          value={value.valueBool}
          onChange={(v) => onChange({ ...emptyValue, valueBool: v })}
        />
      );
    case "scale_5":
      return (
        <ScaleButtons
          max={5}
          value={value.valueInt}
          onChange={(v) => onChange({ ...emptyValue, valueInt: v })}
        />
      );
    case "scale_10":
      return (
        <ScaleButtons
          max={10}
          value={value.valueInt}
          onChange={(v) => onChange({ ...emptyValue, valueInt: v })}
        />
      );
    case "bool_scale_5":
    case "bool_scale_10":
      return (
        <YesNoButtons
          value={value.valueBool}
          onChange={(v) =>
            onChange({
              ...emptyValue,
              valueBool: v,
              valueInt: v ? value.valueInt : null,
            })
          }
        />
      );
    case "number":
      return (
        <NumberInput
          value={value.valueReal}
          unit={parameter.unit}
          onChange={(v) => onChange({ ...emptyValue, valueReal: v })}
        />
      );
    default:
      return null;
  }
}

function YesNoButtons({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-0.5">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={`min-h-[44px] cursor-pointer rounded-[6px] border px-3 text-[15px] font-medium transition sm:min-h-[28px] sm:min-w-[44px] sm:rounded-[3px] sm:px-2 sm:text-[11px] sm:font-normal ${
          value === true
            ? "border-success bg-[rgba(74,222,128,0.12)] text-success"
            : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
        }`}
      >
        Ja
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={`min-h-[44px] cursor-pointer rounded-[6px] border px-3 text-[15px] font-medium transition sm:min-h-[28px] sm:min-w-[44px] sm:rounded-[3px] sm:px-2 sm:text-[11px] sm:font-normal ${
          value === false
            ? "border-mid text-ink"
            : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
        }`}
      >
        Nej
      </button>
    </div>
  );
}

function ScaleButtons({
  max,
  value,
  onChange,
}: {
  max: number;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const gridCols =
    max === 10 ? "grid-cols-10" : max === 5 ? "grid-cols-5" : "grid-cols-3";
  return (
    <div className={`grid ${gridCols} gap-1.5 sm:flex sm:flex-wrap sm:gap-0.5`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`min-h-[44px] cursor-pointer rounded-[6px] border text-[15px] font-medium transition sm:min-h-[28px] sm:min-w-[28px] sm:rounded-[3px] sm:text-[11px] sm:font-normal ${
            value === n
              ? "border-accent bg-accent-bg text-accent-bright"
              : "border-border-light bg-bg text-mid hover:border-accent-dim hover:text-ink"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function NumberInput({
  value,
  unit,
  onChange,
}: {
  value: number | null;
  unit: string | null;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(
    value === null ? "" : String(value).replace(".", ","),
  );
  return (
    <div className="relative w-full sm:w-[110px]">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const t = raw.trim().replace(",", ".");
          if (t === "") {
            onChange(null);
            return;
          }
          const n = Number(t);
          if (Number.isFinite(n)) onChange(n);
        }}
        placeholder="–"
        className="!text-[16px] sm:!text-[12px]"
        style={{
          paddingRight: unit ? "40px" : undefined,
        }}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-dim sm:text-[10px]">
          {unit}
        </span>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.trim() === "" ? null : text)}
      rows={2}
      placeholder="…"
      className="!text-[13px]"
    />
  );
}

function SaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) {
    return <span className="text-[10px] italic text-light">…</span>;
  }
  if (saved) {
    return <Check className="size-3 text-success" />;
  }
  return null;
}
