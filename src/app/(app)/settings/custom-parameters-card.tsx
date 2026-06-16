"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Plus, Trash2, X } from "lucide-react";
import {
  createCustomParameter,
  deleteCustomParameter,
  updateCustomParameter,
  type CustomParamSummary,
} from "@/lib/custom-parameters";

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
    <section className="rounded-md border border-border bg-card px-6 py-5">
      <h2 className="mb-4 border-b border-border-light pb-2.5 font-serif text-[20px] font-medium text-accent-bright">
        Mine parametre
      </h2>
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

      <div className="flex flex-wrap items-center gap-3">
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-bright"
          >
            <Plus className="size-4" />
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
      className={`flex items-center gap-3 rounded-[3px] border border-border-light bg-bg px-3 py-2 text-[13px] ${
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
        className="inline-flex cursor-pointer items-center gap-1 rounded border border-transparent px-2 py-1 text-[11px] text-mid hover:border-border hover:bg-bg hover:text-ink"
        title={parameter.archived ? "Genaktiver" : "Arkiver"}
      >
        {parameter.archived ? (
          <ArchiveRestore className="size-3.5" />
        ) : (
          <Archive className="size-3.5" />
        )}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1 rounded border border-transparent px-2 py-1 text-[11px] text-dim hover:border-border hover:bg-bg hover:text-danger"
        title="Slet"
      >
        <Trash2 className="size-3.5" />
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
    <div className="mt-4 space-y-3 rounded-[3px] border border-border-light bg-bg p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[15px] text-ink">Ny parameter</h3>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-dim hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-medium text-mid">
          Navn
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fx 'Stress-niveau' eller 'Blodtryk systolisk'"
          autoFocus
        />
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-medium text-mid">
          Type
        </label>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
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
          <label className="mb-1 block text-[12px] font-medium text-mid">
            Enhed (valgfri)
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Fx mg, kg, °C, mmHg"
            className="!w-32"
          />
        </div>
      )}

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Opretter..." : "Opret"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-[12px] text-mid hover:text-ink"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}
