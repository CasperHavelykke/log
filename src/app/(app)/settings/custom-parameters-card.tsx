"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Plus, Trash2, X } from "lucide-react";
import {
  createCustomParameter,
  deleteCustomParameter,
  updateCustomParameter,
  type CustomParamSummary,
} from "@/lib/custom-parameters";
import { HEALTH_PRESETS, type ParameterPreset } from "@/lib/parameter-presets";

const KIND_LABELS: Record<string, string> = {
  boolean: "Ja/nej",
  scale_5: "Skala 1-5",
  scale_10: "Skala 1-10",
  bool_scale_5: "Ja/nej + intensitet 1-5",
  bool_scale_10: "Ja/nej + intensitet 1-10",
  number: "Tal (med enhed)",
  text: "Tekst",
};

const KIND_DESCRIPTIONS: Record<string, string> = {
  boolean: "Skete det i dag? Knap med ja/nej",
  scale_5: "Vurder fra 1 til 5 — fx humør, energi",
  scale_10: "Vurder fra 1 til 10 — fx smerteintensitet",
  bool_scale_5: "Skete det? Hvis ja: hvor intenst (1-5)",
  bool_scale_10: "Skete det? Hvis ja: hvor intenst (1-10)",
  number: "Frit tal, med valgfri enhed (kg, mg, °C, etc.)",
  text: "Fri tekst — vises ikke i statistik",
};

export function CustomParametersCard({
  initial,
}: {
  initial: CustomParamSummary[];
}) {
  const [params, setParams] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const visible = showArchived ? params : params.filter((p) => !p.archived);

  return (
    <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[0_1px_0_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3)] sm:p-5">
      <div className="mb-4 border-b border-hair pb-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Mine parametre
        </div>
        <h2 className="mt-0.5 font-serif text-[18px] leading-none text-ink">
          Egne målinger til helbred
        </h2>
      </div>
      <p className="mb-4 text-[13px] text-mid">
        Tilføj dine egne målinger der vises i Helbred-loggen og automatisk
        dukker op som metrics i Statistik. AI (via MCP) får adgang til alle
        dine parametre og deres typer.
      </p>

      {visible.length === 0 ? (
        <p className="mb-3 text-[13px] italic text-light">
          Ingen parametre endnu — opret din første.
        </p>
      ) : (
        <div className="mb-3 space-y-1.5">
          {visible.map((p) => (
            <ParameterRow
              key={p.id}
              parameter={p}
              onArchived={(archived) =>
                setParams((prev) =>
                  prev.map((x) =>
                    x.id === p.id ? { ...x, archived } : x,
                  ),
                )
              }
              onDeleted={() =>
                setParams((prev) => prev.filter((x) => x.id !== p.id))
              }
            />
          ))}
        </div>
      )}

      <PresetSection
        params={params}
        onCreated={(p) => setParams((prev) => [...prev, p])}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Ny parameter
          </button>
        )}
        {params.some((p) => p.archived) && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-light">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-3.5"
            />
            Vis arkiverede
          </label>
        )}
      </div>

      {showCreate && (
        <CreateForm
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setParams((prev) => [...prev, p]);
            setShowCreate(false);
          }}
        />
      )}
    </section>
  );
}

function PresetSection({
  params,
  onCreated,
}: {
  params: CustomParamSummary[];
  onCreated: (p: CustomParamSummary) => void;
}) {
  const [pending, start] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const usedNames = new Set(
    params.map((p) => p.name.trim().toLowerCase()),
  );

  function addPreset(preset: ParameterPreset) {
    setPendingKey(preset.key);
    start(async () => {
      const res = await createCustomParameter({
        name: preset.name,
        kind: preset.kind,
        unit: null,
      });
      setPendingKey(null);
      if (res.ok) {
        onCreated({
          id: res.parameter.id,
          name: res.parameter.name,
          kind: res.parameter.kind as never,
          unit: res.parameter.unit,
          archived: false,
          sortOrder: res.parameter.sortOrder,
        });
      }
    });
  }

  return (
    <div className="mt-4 rounded-[10px] bg-bg-subtle p-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        Hurtigt tilføj — helbreds-præsets
      </p>
      <div className="flex flex-wrap gap-1.5">
        {HEALTH_PRESETS.map((preset) => {
          const added = usedNames.has(preset.name.toLowerCase());
          const loading = pending && pendingKey === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => addPreset(preset)}
              disabled={added || pending}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                added
                  ? "border-hair bg-bg-elevated text-dim"
                  : "border-hair-strong bg-bg-elevated text-mid hover:border-accent hover:text-accent"
              } ${pending ? "cursor-not-allowed" : "cursor-pointer"}`}
              title={preset.description}
            >
              {!added && <Plus className="size-3" />}
              {preset.name}
              {added && (
                <span className="ml-1 text-[10px] text-dim">tilføjet</span>
              )}
              {loading && (
                <span className="ml-1 text-[10px] text-mid">…</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ParameterRow({
  parameter,
  onArchived,
  onDeleted,
}: {
  parameter: CustomParamSummary;
  onArchived: (archived: boolean) => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  function toggleArchive() {
    start(async () => {
      const res = await updateCustomParameter({
        id: parameter.id,
        archived: !parameter.archived,
      });
      if (res.ok) onArchived(!parameter.archived);
    });
  }
  function remove() {
    if (
      !confirm(
        `Slet "${parameter.name}" og alle dens registrerede værdier? Kan ikke fortrydes.`,
      )
    )
      return;
    start(async () => {
      const res = await deleteCustomParameter(parameter.id);
      if (res.ok) onDeleted();
    });
  }
  return (
    <div
      className={`flex items-center gap-3 rounded-[10px] bg-bg-subtle px-3 py-2.5 text-[13px] ${
        parameter.archived ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">
          {parameter.name}
          {parameter.unit && (
            <span className="ml-1 text-[11px] text-light">
              · {parameter.unit}
            </span>
          )}
        </div>
        <div className="text-[11px] text-light">
          {KIND_LABELS[parameter.kind] ?? parameter.kind}
        </div>
      </div>
      <button
        type="button"
        onClick={toggleArchive}
        disabled={pending}
        className="inline-flex cursor-pointer items-center rounded-[6px] p-1.5 text-mid hover:bg-bg hover:text-ink"
        title={parameter.archived ? "Genaktiver" : "Arkiver"}
      >
        {parameter.archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="inline-flex cursor-pointer items-center rounded-[6px] p-1.5 text-dim hover:bg-bg hover:text-danger"
        title="Slet"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function CreateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: CustomParamSummary) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("scale_5");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const showUnit = kind === "number";

  function submit() {
    if (!name.trim()) {
      setError("Navn er påkrævet");
      return;
    }
    setError(null);
    start(async () => {
      const res = await createCustomParameter({
        name: name.trim(),
        kind: kind as never,
        unit: showUnit ? unit.trim() || null : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated({
        id: res.parameter.id,
        name: res.parameter.name,
        kind: res.parameter.kind as never,
        unit: res.parameter.unit,
        archived: false,
        sortOrder: res.parameter.sortOrder,
      });
    });
  }

  return (
    <div className="mt-4 space-y-3 rounded-[10px] bg-bg-subtle p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[15px] text-ink">Ny parameter</h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex cursor-pointer items-center rounded-[6px] p-1 text-dim hover:bg-bg hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Navn
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fx 'Stress-niveau' eller 'Blodtryk systolisk'"
          autoFocus
          className="!rounded-[8px] !border-hair !bg-bg"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Type
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="!rounded-[8px] !border-hair !bg-bg"
        >
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-dim">
          {KIND_DESCRIPTIONS[kind]}
        </p>
      </div>

      {showUnit && (
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Enhed (valgfri)
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Fx mg, kg, °C, mmHg"
            className="!w-32 !rounded-[8px] !border-hair !bg-bg"
          />
        </div>
      )}

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Opretter…" : "Opret"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:text-ink"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}
