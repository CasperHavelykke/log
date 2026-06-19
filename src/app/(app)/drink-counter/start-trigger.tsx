"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Beer } from "lucide-react";
import { startSession } from "./actions";

export function StartCounterTrigger() {
  const [open, setOpen] = useState(false);
  const [pending, startTx] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function start() {
    setErr(null);
    startTx(async () => {
      const res = await startSession();
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      // Layout-gate vil registrere den aktive session.
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-accent hover:underline"
      >
        <Beer className="size-3.5" />
        Start genstande-tæller
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-t-[18px] bg-bg-elevated p-6 shadow-xl sm:rounded-[14px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-bg text-accent">
                <Beer className="size-5" />
              </span>
              <h3 className="font-serif text-[20px] text-ink">
                Genstande-tæller
              </h3>
            </div>
            <div className="mb-5 space-y-2 text-[13px] text-mid">
              <p>
                Tæl genstande mens du er ude. Tryk på en knap for hver
                drink — alm. drink, shot (1 g.) eller stærk shot (2 g.).
              </p>
              <p>
                Når sessionen er aktiv, åbner appen direkte i tælleren —
                også hvis du lukker og åbner den. Du kan altid trykke
                &quot;til appen&quot; og komme tilbage til tælleren via
                den flydende knap.
              </p>
              <p>
                Alle genstande bookføres på dagens dato i din alkohol-log,
                også hvis du krydser midnat.
              </p>
            </div>
            {err && (
              <p className="mb-3 text-[13px] text-danger">{err}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={start}
                disabled={pending}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent px-4 py-3 text-[14px] font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "Starter…" : "Start tæller"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="cursor-pointer rounded-[10px] px-4 py-3 text-[14px] text-mid hover:text-ink"
              >
                Annullér
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
