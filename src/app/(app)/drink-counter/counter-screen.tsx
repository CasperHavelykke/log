"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { addDrink, endSession, getActiveSession, removeDrink } from "./actions";
import {
  DEFAULT_BODY_WEIGHT_KG,
  KIND_LABEL,
  KIND_UNITS_X10,
  activeUnitsX10,
  burnUnitsX10PerHour,
  fmtUnitsX10,
  paceLevel,
  type ActiveSessionPayload,
  type DrinkKind,
} from "./constants";

// Optimistisk UI med baggrundskø: hvert tryk opdaterer tallet ØJEBLIKKELIGT
// og lægger server-skrivningen i en seriel kø — knapperne låses aldrig, og
// hvert indtag er alligevel gemt på serveren sekunder senere (i modsætning
// til "gem alt ved afslut", hvor en død telefon koster hele aftenen).
// Fortryd virker også på tryk der endnu ikke er nået frem: de markeres
// cancelled og slettes så snart serveren har givet dem et id.

type LocalLog = {
  clientId: string;
  serverId: number | null;
  unitsX10: number;
  kind: DrinkKind;
  occurredAt: string;
};

type Meta = { serverId: number | null; cancelled: boolean };

export function CounterScreen({
  initial,
  onEscape,
}: {
  initial: ActiveSessionPayload;
  onEscape: () => void;
}) {
  const metaRef = useRef(new Map<string, Meta>());
  const [logs, setLogs] = useState<LocalLog[]>(() =>
    initial.logs.map((l) => {
      const clientId = `srv-${l.id}`;
      metaRef.current.set(clientId, { serverId: l.id, cancelled: false });
      return {
        clientId,
        serverId: l.id,
        unitsX10: l.unitsX10,
        kind: l.kind,
        occurredAt: l.occurredAt,
      };
    }),
  );
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const [inFlight, setInFlight] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function enqueue(task: () => Promise<void>) {
    setInFlight((n) => n + 1);
    queueRef.current = queueRef.current
      .then(task)
      .catch(() => {
        // Netværksfejl: hent serverens sandhed frem for at gætte.
        return resync();
      })
      .finally(() => setInFlight((n) => n - 1));
  }

  async function resync() {
    const fresh = await getActiveSession();
    if (!fresh) return;
    metaRef.current = new Map();
    setLogs(
      fresh.logs.map((l) => {
        const clientId = `srv-${l.id}`;
        metaRef.current.set(clientId, { serverId: l.id, cancelled: false });
        return {
          clientId,
          serverId: l.id,
          unitsX10: l.unitsX10,
          kind: l.kind,
          occurredAt: l.occurredAt,
        };
      }),
    );
  }

  function press(kind: DrinkKind) {
    const clientId = crypto.randomUUID();
    metaRef.current.set(clientId, { serverId: null, cancelled: false });
    setLogs((prev) => [
      ...prev,
      {
        clientId,
        serverId: null,
        unitsX10: KIND_UNITS_X10[kind],
        kind,
        occurredAt: new Date().toISOString(),
      },
    ]);
    enqueue(async () => {
      const res = await addDrink({ kind });
      const meta = metaRef.current.get(clientId);
      if (!res.ok) {
        await resync();
        return;
      }
      if (!meta) return;
      meta.serverId = res.log.id;
      if (meta.cancelled) {
        // Fortrudt mens tilføjelsen var undervejs.
        await removeDrink({ logId: res.log.id });
        return;
      }
      setLogs((prev) =>
        prev.map((l) =>
          l.clientId === clientId
            ? { ...l, serverId: res.log.id, occurredAt: res.log.occurredAt }
            : l,
        ),
      );
    });
  }

  function undo(clientId: string) {
    const meta = metaRef.current.get(clientId);
    setLogs((prev) => prev.filter((l) => l.clientId !== clientId));
    if (!meta) return;
    if (meta.serverId === null) {
      meta.cancelled = true;
      return;
    }
    const serverId = meta.serverId;
    enqueue(async () => {
      const res = await removeDrink({ logId: serverId });
      if (!res.ok) await resync();
    });
  }

  function confirmEnd() {
    const totalX10 = logs.reduce((s, l) => s + l.unitsX10, 0);
    if (
      !confirm(
        `Afslut session? Du har talt ${fmtUnitsX10(totalX10)} genstande. ` +
          "Tællingen lægges på din alkohol-log for dagen.",
      )
    ) {
      return;
    }
    setEnding(true);
    void (async () => {
      // Flush køen så alle tryk er gemt, før sessionen lukkes.
      await queueRef.current;
      await endSession();
      window.location.href = "/today";
    })();
  }

  const totalX10 = logs.reduce((s, l) => s + l.unitsX10, 0);
  const elapsed = formatElapsed(now - new Date(initial.startedAt).getTime());

  // Tempo-indikator: aktive genstande i kroppen lige nu (indtag minus
  // forbrænding), kalibreret efter seneste vejning. Opdateres af samme
  // 30s-puls som uret, og falder derfor synligt under pauser.
  const weightX10 = initial.bodyWeightX10 ?? DEFAULT_BODY_WEIGHT_KG * 10;
  const weightKg = weightX10 / 10;
  const activeX10 = activeUnitsX10(logs, now, weightKg);
  const pace = paceLevel(activeX10);

  return (
    <div
      className="fixed inset-0 flex h-[100vh] flex-col overflow-hidden bg-bg text-ink"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <header className="flex shrink-0 items-center justify-between px-5 pt-6 pb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.6px] text-light">
          Aktiv · {elapsed}
        </span>
        <button
          type="button"
          onClick={onEscape}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hair-strong px-3 py-1.5 text-[12px] text-mid hover:border-accent hover:text-accent"
        >
          <ArrowLeft className="size-3.5" />
          Til appen
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-4">
        <div className="mb-6 flex flex-col items-center">
          <div
            className="font-serif text-[110px] leading-none text-accent"
            style={{ letterSpacing: "-3px" }}
          >
            {fmtUnitsX10(totalX10)}
          </div>
          <div className="mt-2 text-[13px] text-mid">
            {totalX10 === 10 ? "genstand" : "genstande"} i alt
          </div>
        </div>

        {totalX10 > 0 && (
          <div
            className="mb-6 w-full max-w-[420px] rounded-[10px] px-4 py-2.5 text-center"
            style={{ background: pace.softBg }}
          >
            {pace.alarm ? (
              <div
                className="py-1 text-[24px] font-bold uppercase tracking-[2px]"
                style={{ color: pace.color }}
              >
                {pace.label}
              </div>
            ) : (
              <div
                className="text-[13px] font-medium"
                style={{ color: pace.color }}
              >
                ~{fmtUnitsX10(Math.round(activeX10))} aktive genstande i
                kroppen · {pace.label}
              </div>
            )}
            <div
              className="mt-0.5 text-[10px]"
              style={{
                color: pace.alarm ? "rgba(255,255,255,0.85)" : undefined,
              }}
            >
              {pace.alarm && (
                <>
                  ~{fmtUnitsX10(Math.round(activeX10))} aktive genstande —
                  dømmekraften er reelt væk herfra.{" "}
                </>
              )}
              <span className={pace.alarm ? "" : "text-light"}>
                Forbrænding ca.{" "}
                {fmtUnitsX10(Math.round(burnUnitsX10PerHour(weightKg)))}{" "}
                genstand/time ved {fmtUnitsX10(weightX10)} kg
                {initial.bodyWeightX10 === null
                  ? " (standard — log din vægt på I dag for at kalibrere)"
                  : ""}{" "}
                — tommelfingerregel, ikke promille.
              </span>
            </div>
          </div>
        )}

        <div className="w-full max-w-[420px] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <BigButton kind="øl" onPress={press} disabled={ending} />
            <BigButton kind="drink" onPress={press} disabled={ending} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                "mildt_shot_2",
                "mildt_shot_4",
                "stærkt_shot_2",
                "stærkt_shot_4",
              ] as const
            ).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => press(kind)}
                disabled={ending}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] bg-bg-elevated px-3 py-3.5 text-[13px] font-medium text-ink transition active:scale-[0.98] disabled:opacity-60"
              >
                <Plus className="size-3.5" />
                {KIND_LABEL[kind]}
                <span className="text-[11px] text-light">
                  ({fmtUnitsX10(KIND_UNITS_X10[kind])})
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>

      <section className="shrink-0 border-t border-hair px-5 py-4">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-light">
              Indtag
            </span>
            {inFlight > 0 && (
              <Loader2 className="size-3 animate-spin text-light" />
            )}
          </div>
          {/* Fast højde: sektionen må ikke vokse med listen — så løfter
              tælleren og knapperne sig ved hvert tryk. */}
          {logs.length === 0 ? (
            <p className="flex h-[22vh] items-start text-[12px] italic text-dim">
              Ingen indtag endnu. Tryk på en knap ovenfor.
            </p>
          ) : (
            <ul className="h-[22vh] space-y-1.5 overflow-y-auto overscroll-contain">
              {[...logs].reverse().map((l) => (
                <li
                  key={l.clientId}
                  className="flex items-center gap-3 rounded-[8px] bg-bg-elevated px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-ink">
                    {KIND_LABEL[l.kind]}
                  </span>
                  <span className="text-accent">
                    {fmtUnitsX10(l.unitsX10)} g.
                  </span>
                  <span className="ml-auto text-[11px] text-light">
                    {l.serverId === null ? "…" : formatTime(l.occurredAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => undo(l.clientId)}
                    className="cursor-pointer text-dim hover:text-danger"
                    title="Fortryd"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer
        className="shrink-0 border-t border-hair px-5 pt-4"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        }}
      >
        <button
          type="button"
          onClick={confirmEnd}
          disabled={ending}
          className="mx-auto block cursor-pointer text-[12px] text-light hover:text-danger disabled:opacity-50"
        >
          {ending ? "Afslutter…" : "Afslut session"}
        </button>
      </footer>
    </div>
  );
}

function BigButton({
  kind,
  onPress,
  disabled,
}: {
  kind: DrinkKind;
  onPress: (kind: DrinkKind) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPress(kind)}
      disabled={disabled}
      className="flex cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-accent px-4 py-5 text-[17px] font-semibold text-white shadow-[0_8px_24px_rgba(110,169,242,0.35)] transition active:scale-[0.98] disabled:opacity-60"
    >
      <Plus className="size-5" />
      {KIND_LABEL[kind]}
    </button>
  );
}

function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}t ${m}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
