"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Beer, Bird, ChevronDown, ChevronUp, Loader2, Martini, X } from "lucide-react";
import {
  BeerIcon,
  Shot2clIcon,
  Shot2clStrongIcon,
  Shot4clIcon,
  Shot4clStrongIcon,
} from "./icons";
import { addDrink, endSession, getActiveSession, removeDrink } from "./actions";
import {
  DEFAULT_BODY_WEIGHT_KG,
  KIND_LABEL,
  KIND_UNITS_X10,
  activeUnitsX10,
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

// Shot-knapperne bryder BEVIDST over to linjer (type øverst, størrelse
// nederst) — de fulde et-linjes labels sprængte gridet på små skærme.
const SHOT_BUTTON_TOP: Partial<Record<DrinkKind, string>> = {
  mildt_shot_2: "Alm. shot",
  mildt_shot_4: "Alm. shot",
  stærkt_shot_2: "Stærkt shot",
  stærkt_shot_4: "Stærkt shot",
};
const SHOT_BUTTON_BOTTOM: Partial<Record<DrinkKind, string>> = {
  mildt_shot_2: "2 cl",
  mildt_shot_4: "4 cl",
  stærkt_shot_2: "2 cl",
  stærkt_shot_4: "4 cl",
};

export function CounterScreen({
  initial,
  counterMode = false,
  roisin = false,
  onEscape,
}: {
  initial: ActiveSessionPayload;
  // Genstandstæller-tilstand: afslut fører til startskærmen, ikke /today.
  counterMode?: boolean;
  // Roisin mode: lyserød skin, maskot og udvidet knapsæt.
  roisin?: boolean;
  onEscape: () => void;
}) {
  const router = useRouter();
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
  // Roisin: næste drink-tryk logges som dobbelt (ekstra 2 cl i drinken).
  const [doubleDrink, setDoubleDrink] = useState(false);
  // Indtags-listen kan klappes sammen, så knapperne får mere plads.
  const [logsOpen, setLogsOpen] = useState(true);

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
      // BLØD navigation: en hård window.location afbrød revalidate-
      // genhentningen fra endSession, og Next's fejlskærm blinkede forbi.
      // Layoutet re-evaluerer selv: tilstand → startskærm, ellers I dag.
      if (counterMode) {
        router.refresh();
      } else {
        router.push("/today");
      }
    })();
  }

  const totalX10 = logs.reduce((s, l) => s + l.unitsX10, 0);
  const elapsed = formatElapsed(now - new Date(initial.startedAt).getTime());

  // Maskottens replikker følger tempo-niveauet (duolingo-agtigt nøk).
  const mascotLine = (key: string, empty: boolean): string => {
    if (empty) return "Klar når du er!";
    switch (key) {
      case "ro":
        return "Jeg holder øje. Skål!";
      case "gul":
        return "Sådan — stille og roligt…";
      case "orange":
        return "Et glas vand ville klæde dig.";
      case "rød":
        return "Vand. Nu. Jeg mener det.";
      default:
        return "HJEM. NU. Jeg ringer efter en taxa.";
    }
  };

  // Tempo-indikator: aktive genstande i kroppen lige nu (indtag minus
  // forbrænding), kalibreret efter seneste vejning. Opdateres af samme
  // 30s-puls som uret, og falder derfor synligt under pauser.
  const weightX10 = initial.bodyWeightX10 ?? DEFAULT_BODY_WEIGHT_KG * 10;
  const weightKg = weightX10 / 10;
  const activeX10 = activeUnitsX10(logs, now, weightKg);
  const pace = paceLevel(activeX10);

  return (
    <div
      className={`fixed inset-0 flex h-[100vh] flex-col overflow-hidden bg-bg text-ink ${roisin ? "roisin" : ""}`}
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

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-4">
        <div className="my-auto flex w-full flex-col items-center">
        {roisin && (
          <div className="mb-3 flex items-center gap-2.5">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-bg text-accent">
              <Bird className="size-6" strokeWidth={1.75} />
            </span>
            <span className="rounded-[10px] rounded-bl-[2px] bg-bg-elevated px-3 py-1.5 text-[12px] italic text-mid">
              {mascotLine(pace.key, totalX10 === 0)}
            </span>
          </div>
        )}
        <div className="mb-4 flex flex-col items-center sm:mb-6">
          <div
            className="font-serif text-[76px] leading-none text-accent sm:text-[110px]"
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
            className="mb-4 w-full max-w-[420px] rounded-[10px] px-4 py-2.5 text-center sm:mb-6"
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
            {pace.alarm && (
              <div
                className="mt-0.5 text-[10px]"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                ~{fmtUnitsX10(Math.round(activeX10))} aktive genstande —
                dømmekraften er reelt væk herfra.
              </div>
            )}
          </div>
        )}

        <div className="w-full max-w-[420px] space-y-3">
          {roisin ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["roisin_øl_alm", "Alm. øl", "33 cl"],
                    ["roisin_øl_stor", "Stor øl", "50 cl"],
                    ["roisin_øl_alm_stærk", "Stærk øl", "33 cl"],
                    ["roisin_øl_stor_stærk", "Stærk øl", "50 cl"],
                  ] as const
                ).map(([kind, top, bottom]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => press(kind)}
                    disabled={ending}
                    className="flex cursor-pointer flex-wrap items-center justify-center gap-x-1 gap-y-0.5 rounded-[12px] bg-accent px-2 py-3 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(236,72,153,0.35)] transition active:scale-[0.98] disabled:opacity-60"
                  >
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      {/* 33 cl = Caspers slanke flaske; 50 cl = Lucides
                          krus — størrelsen aflæses på ikonet. */}
                      {bottom === "50 cl" ? (
                        <Beer className="size-4 shrink-0" />
                      ) : (
                        <BeerIcon className="h-4 w-auto shrink-0" />
                      )}
                      {top}
                    </span>
                    <span className="whitespace-nowrap">{bottom}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-light">
                  Drinks
                </span>
                <button
                  type="button"
                  onClick={() => setDoubleDrink((d) => !d)}
                  aria-pressed={doubleDrink}
                  className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-medium transition ${
                    doubleDrink
                      ? "bg-accent text-white"
                      : "bg-bg-elevated text-mid hover:text-ink"
                  }`}
                >
                  Dobbelt shot {doubleDrink ? "TIL" : "fra"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["roisin_drink_mild", "Mild"],
                    ["roisin_drink_mellem", "Mellem"],
                    ["roisin_drink_stærk", "Stærk"],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      press(
                        doubleDrink ? (`${kind}_dbl` as DrinkKind) : kind,
                      );
                      setDoubleDrink(false);
                    }}
                    disabled={ending}
                    className="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[12px] bg-bg-elevated px-2 py-2.5 text-[13px] font-medium text-ink transition active:scale-[0.98] disabled:opacity-60"
                  >
                    <Martini className="size-4 text-accent" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <BigButton
                kind="øl"
                icon={<BeerIcon className="h-6 w-auto" />}
                onPress={press}
                disabled={ending}
              />
              <BigButton
                kind="drink"
                icon={<Martini className="size-5" />}
                onPress={press}
                disabled={ending}
              />
            </div>
          )}
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
                className="flex cursor-pointer flex-wrap items-center justify-center gap-x-1 gap-y-0.5 rounded-[12px] bg-bg-elevated px-2 py-2.5 text-[13px] font-medium text-ink transition active:scale-[0.98] disabled:opacity-60 sm:py-3"
              >
                {/* To nowrap-stykker i en flex-wrap: én linje når der er
                    plads, og bryder ellers præcis før "2 cl". */}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  {kind === "mildt_shot_2" ? (
                    <Shot2clIcon className="h-4 w-auto shrink-0" />
                  ) : kind === "mildt_shot_4" ? (
                    <Shot4clIcon className="h-4 w-auto shrink-0" />
                  ) : kind === "stærkt_shot_2" ? (
                    <Shot2clStrongIcon className="h-4 w-auto shrink-0" />
                  ) : (
                    <Shot4clStrongIcon className="h-4 w-auto shrink-0" />
                  )}
                  {SHOT_BUTTON_TOP[kind] ?? KIND_LABEL[kind]}
                </span>
                <span className="whitespace-nowrap">
                  {SHOT_BUTTON_BOTTOM[kind]}
                </span>
              </button>
            ))}
          </div>
        </div>
        </div>
      </main>

      <section className="shrink-0 border-t border-hair px-5 py-4">
        <div className="mx-auto w-full max-w-[420px]">
          <button
            type="button"
            onClick={() => setLogsOpen((o) => !o)}
            aria-expanded={logsOpen}
            className="mb-2 flex w-full cursor-pointer items-baseline justify-between"
            title={logsOpen ? "Skjul indtag" : "Vis indtag"}
          >
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-light">
              Indtag
              {logsOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronUp className="size-3" />
              )}
              {!logsOpen && logs.length > 0 && (
                <span className="normal-case tracking-normal">
                  ({logs.length})
                </span>
              )}
            </span>
            {inFlight > 0 && (
              <Loader2 className="size-3 animate-spin text-light" />
            )}
          </button>
          {/* Fast højde når åben: sektionen må ikke vokse med listen —
              så løfter tælleren og knapperne sig ved hvert tryk. Klappet
              sammen viser den kun overskriften. */}
          {!logsOpen ? null : logs.length === 0 ? (
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
  icon,
  onPress,
  disabled,
}: {
  kind: DrinkKind;
  icon: React.ReactNode;
  onPress: (kind: DrinkKind) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPress(kind)}
      disabled={disabled}
      className="flex cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-accent px-4 py-4 text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(110,169,242,0.35)] transition active:scale-[0.98] disabled:opacity-60 sm:py-5 sm:text-[17px]"
    >
      {icon}
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
