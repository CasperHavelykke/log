"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleDashed,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import type { GoalView } from "@/lib/goals";
import type { GoalKind } from "@/db/schema";
import {
  deleteGoal,
  deleteGoalEntry,
  listGoalEntries,
  logGoalProgress,
  setMilestoneDone,
  upsertGoal,
  type GoalInput,
} from "./goal-actions";
import { formatDanishDate, todayIsoDate } from "@/lib/date";

// Årsmål-kortet: langtidsmål med kurs-bjælker. Fyldt bjælke = hvor langt
// du er; den lille markør = hvor kursen siger du burde være i dag.
// Grøn = på/foran kurs, rav = bagud. Optællinger har +1-genvej, niveauer
// en "opdatér tal"-genvej, milepæle et kryds.

export function YearGoalsCard({ goals }: { goals: GoalView[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<GoalView | "new" | null>(null);
  const [levelEditId, setLevelEditId] = useState<number | null>(null);
  const [levelInput, setLevelInput] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, start] = useTransition();

  function run(id: number, fn: () => Promise<unknown>) {
    setPendingId(id);
    start(async () => {
      await fn();
      setPendingId(null);
      router.refresh();
    });
  }

  // Grupper i den rækkefølge de først optræder; u-grupperede til sidst.
  const groupOrder: (string | null)[] = [];
  for (const g of goals) {
    if (!groupOrder.includes(g.groupLabel)) groupOrder.push(g.groupLabel);
  }
  groupOrder.sort((a, b) => (a === null ? 1 : 0) - (b === null ? 1 : 0));

  const doneCount = goals.filter((g) => g.done).length;

  return (
    <section className="mb-4 rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-3 flex items-baseline justify-between border-b border-hair pb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          Årsmål
        </span>
        {goals.length > 0 && (
          <span className="text-[11px] text-light">
            {doneCount}/{goals.length} i mål
          </span>
        )}
      </div>

      {groupOrder.map((group) => (
        <div key={group ?? "__none"} className="mb-3 last:mb-0">
          {group !== null && (
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.5px] text-dim">
              {group}
            </div>
          )}
          <ul className="space-y-2.5">
            {goals
              .filter((g) => g.groupLabel === group)
              .map((g) => {
                const pending = pendingId === g.id;
                const behind =
                  !g.done && g.expected !== null && g.current < g.expected;
                const valueClass = g.done
                  ? "text-success"
                  : behind
                    ? "text-warning"
                    : "text-mid";
                const fillClass = g.done
                  ? "bg-success"
                  : behind
                    ? "bg-warning"
                    : "bg-success";
                const pct = (v: number) =>
                  g.targetValue === null || g.targetValue === 0
                    ? 0
                    : Math.min(100, Math.max(0, (v / g.targetValue) * 100));

                return (
                  <li key={g.id}>
                    <div className="flex items-center gap-2">
                      {g.kind === "milestone" ? (
                        <button
                          type="button"
                          onClick={() =>
                            run(g.id, () => setMilestoneDone(g.id, !g.done))
                          }
                          disabled={pending}
                          title={g.done ? "Fortryd" : "Markér som nået"}
                          className={`inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border transition disabled:opacity-50 ${
                            g.done
                              ? "border-transparent bg-[var(--success-soft)] text-success"
                              : "border-hair-strong text-dim hover:border-accent hover:text-accent"
                          }`}
                        >
                          {pending ? (
                            <CircleDashed className="size-3.5 animate-spin" />
                          ) : g.done ? (
                            <Check className="size-3.5" strokeWidth={2.5} />
                          ) : (
                            <Target className="size-3.5" />
                          )}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setEdit(g)}
                        title="Redigér målet"
                        className={`min-w-0 flex-1 cursor-pointer truncate text-left text-[13px] hover:text-accent ${
                          g.done ? "text-mid line-through" : "text-ink"
                        }`}
                      >
                        {g.title}
                      </button>

                      <span
                        className={`shrink-0 text-[11px] tabular-nums ${valueClass}`}
                      >
                        {g.kind === "milestone"
                          ? g.done
                            ? "nået"
                            : `inden ${formatDanishDate(g.deadline)}`
                          : `${g.current} / ${g.targetValue}${g.unit ? ` ${g.unit}` : ""}`}
                      </span>

                      {g.kind === "count" && !g.done && (
                        <button
                          type="button"
                          onClick={() =>
                            run(g.id, () =>
                              logGoalProgress({ goalId: g.id, value: 1 }),
                            )
                          }
                          disabled={pending}
                          title="Log +1 i dag"
                          className="inline-flex min-h-[28px] shrink-0 cursor-pointer items-center gap-0.5 rounded-[6px] bg-bg-subtle px-2 text-[11px] font-medium text-mid hover:text-accent disabled:opacity-50"
                        >
                          {pending ? (
                            <CircleDashed className="size-3 animate-spin" />
                          ) : (
                            <Plus className="size-3" />
                          )}
                          1
                        </button>
                      )}
                      {g.kind === "level" && (
                        <button
                          type="button"
                          onClick={() => {
                            setLevelEditId(levelEditId === g.id ? null : g.id);
                            setLevelInput(String(g.current || ""));
                          }}
                          title="Opdatér tallet"
                          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] bg-bg-subtle text-dim hover:text-accent"
                        >
                          <Pencil className="size-3" />
                        </button>
                      )}
                    </div>

                    {g.kind !== "milestone" && (
                      <div className="relative mt-1.5 h-1.5 rounded-full bg-bg">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${fillClass}`}
                          style={{ width: `${pct(g.current)}%` }}
                        />
                        {g.expected !== null && !g.done && (
                          <div
                            title={`Kurs: ${g.expected}${g.unit ? ` ${g.unit}` : ""} i dag`}
                            className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-dim"
                            style={{ left: `${pct(g.expected)}%` }}
                          />
                        )}
                      </div>
                    )}

                    {levelEditId === g.id && (
                      <form
                        className="mt-1.5 flex items-center gap-1.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const n = Number(levelInput.replace(/\D/g, ""));
                          if (!Number.isFinite(n)) return;
                          setLevelEditId(null);
                          run(g.id, () =>
                            logGoalProgress({ goalId: g.id, value: n }),
                          );
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          autoFocus
                          value={levelInput}
                          onChange={(e) => setLevelInput(e.target.value)}
                          placeholder={`fx ${g.expected ?? 100}`}
                          className="!w-28 !rounded-[8px] !border-hair !bg-bg-subtle !py-1.5 !text-[13px]"
                        />
                        <button
                          type="submit"
                          className="min-h-[28px] cursor-pointer rounded-[6px] bg-accent px-2.5 text-[11px] font-medium text-white hover:bg-accent-bright"
                        >
                          Gem måling
                        </button>
                        <button
                          type="button"
                          onClick={() => setLevelEditId(null)}
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-dim hover:text-ink"
                        >
                          <X className="size-3.5" />
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setEdit("new")}
        className="mt-2 inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-[8px] border border-dashed border-hair-strong px-2.5 py-1 text-[12px] text-light hover:border-accent hover:text-accent"
      >
        <Plus className="size-3" />
        Nyt mål
      </button>

      {edit !== null && (
        <GoalDialog
          existing={edit === "new" ? null : edit}
          groupSuggestions={[
            ...new Set(goals.map((g) => g.groupLabel).filter(Boolean)),
          ] as string[]}
          onChanged={() => router.refresh()}
          onClose={() => setEdit(null)}
        />
      )}
    </section>
  );
}

const KIND_LABELS: Record<GoalKind, string> = {
  count: "Optælling",
  level: "Niveau",
  milestone: "Milepæl",
};

function GoalDialog({
  existing,
  groupSuggestions,
  onChanged,
  onClose,
}: {
  existing: GoalView | null;
  groupSuggestions: string[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [groupLabel, setGroupLabel] = useState(existing?.groupLabel ?? "");
  const [kind, setKind] = useState<GoalKind>(existing?.kind ?? "count");
  const [target, setTarget] = useState(
    existing?.targetValue === null || existing === null
      ? ""
      : String(existing.targetValue),
  );
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [startDate, setStartDate] = useState(
    existing?.startDate ?? todayIsoDate(),
  );
  const [deadline, setDeadline] = useState(existing?.deadline ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [entries, setEntries] = useState<
    { id: number; date: string; value: number; note: string | null }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();

  // Seneste registreringer (fortryd-liste) hentes ved åbning af et
  // eksisterende optællings-/niveau-mål.
  useEffect(() => {
    if (existing && existing.kind !== "milestone") {
      void listGoalEntries(existing.id).then(setEntries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    setError(null);
    const t = Number(target.replace(/\D/g, ""));
    const input: GoalInput = {
      id: existing?.id,
      title,
      groupLabel: groupLabel.trim() || null,
      kind,
      targetValue: kind === "milestone" ? null : Number.isFinite(t) && t > 0 ? t : null,
      unit: unit.trim() || null,
      startDate,
      deadline,
      note: note.trim() || null,
    };
    startT(async () => {
      const res = await upsertGoal(input);
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
    if (!confirm("Slet målet og dets historik?")) return;
    startT(async () => {
      await deleteGoal(existing.id);
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
              Årsmål
            </div>
            <h2 className="mt-0.5 font-serif text-[20px] leading-none text-ink">
              {existing ? existing.title : "Nyt mål"}
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

        <div className="space-y-3">
          <div>
            <FieldLabel>Titel</FieldLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="fx '40 færdige malerier'"
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
            />
          </div>

          <div>
            <FieldLabel>Gruppe (valgfri)</FieldLabel>
            <input
              type="text"
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              placeholder="fx 'Det du selv bestemmer'"
              list="goal-groups"
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
            />
            <datalist id="goal-groups">
              {groupSuggestions.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div>
            <FieldLabel>Type</FieldLabel>
            <div className="inline-flex gap-0.5 rounded-[8px] bg-bg p-0.5">
              {(Object.keys(KIND_LABELS) as GoalKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`cursor-pointer rounded-[6px] px-3 py-1.5 text-[12px] transition ${
                    kind === k
                      ? "bg-accent font-medium text-white"
                      : "text-mid hover:text-ink"
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] italic text-light">
              {kind === "count"
                ? "Fremskridt logges løbende (+1 ad gangen) og lægges sammen."
                : kind === "level"
                  ? "Du måler en tilstand af og til (fx følgertal) — nyeste måling gælder."
                  : "Sket/ikke sket inden deadline."}
            </p>
          </div>

          {kind !== "milestone" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Mål-tal</FieldLabel>
                <input
                  type="text"
                  inputMode="numeric"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="fx 40"
                  className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
                />
              </div>
              <div>
                <FieldLabel>Enhed (valgfri)</FieldLabel>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="malerier / kr / følgere"
                  className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Start</FieldLabel>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
              />
            </div>
            <div>
              <FieldLabel>Deadline</FieldLabel>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Note (valgfri)</FieldLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="fx 'under et om ugen når jeg er i gang'"
              className="!rounded-[8px] !border-hair !bg-bg-subtle !text-[13px]"
            />
          </div>

          {entries !== null && entries.length > 0 && (
            <div>
              <FieldLabel>Seneste registreringer</FieldLabel>
              <ul className="space-y-1">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-[6px] bg-bg-subtle px-2 py-1 text-[12px] text-mid"
                  >
                    <span>
                      {formatDanishDate(e.date)} ·{" "}
                      {existing?.kind === "count" && e.value > 0 ? "+" : ""}
                      {e.value}
                      {e.note ? ` — ${e.note}` : ""}
                    </span>
                    <button
                      type="button"
                      title="Slet registreringen"
                      onClick={() => {
                        void deleteGoalEntry(e.id).then(() => {
                          setEntries((prev) =>
                            prev ? prev.filter((x) => x.id !== e.id) : prev,
                          );
                          onChanged();
                        });
                      }}
                      className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-dim hover:text-danger"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hair pt-4">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
          >
            <Check className="size-3.5" strokeWidth={2.5} />
            {pending ? "Gemmer…" : "Gem mål"}
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
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              title="Slet målet"
              className="inline-flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-[8px] p-2 text-dim hover:bg-bg hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
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
