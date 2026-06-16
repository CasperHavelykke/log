"use client";

import { useState, useTransition } from "react";
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
    <div className="rounded-[3px] border border-border-light bg-bg p-3">
      <div className="mb-2 text-[13px] font-medium text-mid">Mine parametre</div>
      <div className="space-y-3">
        {parameters.map((p) => (
          <ParameterInput
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
    </div>
  );
}

function ParameterInput({
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
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-[12px] font-medium text-mid">
          {parameter.name}
          {parameter.unit && (
            <span className="ml-1 text-[10px] text-dim">
              · {parameter.unit}
            </span>
          )}
        </label>
        <SaveIndicator saving={saving} saved={savedRecently} />
      </div>
      {renderInput(parameter, value, onChange)}
    </div>
  );
}

function renderInput(
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
    case "bool_scale_10": {
      const max = parameter.kind === "bool_scale_5" ? 5 : 10;
      return (
        <div className="space-y-2">
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
          {value.valueBool === true && (
            <ScaleButtons
              max={max}
              value={value.valueInt}
              onChange={(v) =>
                onChange({ ...emptyValue, valueBool: true, valueInt: v })
              }
            />
          )}
        </div>
      );
    }
    case "number":
      return (
        <NumberInput
          value={value.valueReal}
          unit={parameter.unit}
          onChange={(v) => onChange({ ...emptyValue, valueReal: v })}
        />
      );
    case "text":
      return (
        <TextInput
          value={value.valueText}
          onChange={(v) => onChange({ ...emptyValue, valueText: v })}
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
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={`min-h-[36px] cursor-pointer rounded-[3px] border px-3 py-1.5 text-[13px] ${
          value === true
            ? "border-success bg-[rgba(74,222,128,0.15)] text-success"
            : "border-border bg-bg text-mid hover:border-accent-dim hover:text-ink"
        }`}
      >
        Ja
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={`min-h-[36px] cursor-pointer rounded-[3px] border px-3 py-1.5 text-[13px] ${
          value === false
            ? "border-mid bg-bg text-ink"
            : "border-border bg-bg text-mid hover:border-accent-dim hover:text-ink"
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
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`min-h-[36px] min-w-[36px] cursor-pointer rounded-[3px] border text-[13px] ${
            value === n
              ? "border-accent bg-accent-bg text-accent-bright"
              : "border-border bg-bg text-mid hover:border-accent-dim hover:text-ink"
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
    <div className="relative max-w-[180px]">
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
        className={unit ? "!pr-10" : ""}
      />
      {unit && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-dim">
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
    />
  );
}

function SaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) {
    return <span className="text-[10px] italic text-light">Gemmer…</span>;
  }
  if (saved) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-success">
        <Check className="size-3" />
        Gemt
      </span>
    );
  }
  return null;
}
