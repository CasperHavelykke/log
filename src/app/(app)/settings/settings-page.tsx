"use client";

import { useRef, useState, useTransition } from "react";
import { changePassword, importData } from "./actions";

export function SettingsPage({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-[680px] px-5 py-8">
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[36px] font-medium leading-none text-ink">
          Indstillinger
        </h1>
        <p className="mt-1 font-serif text-sm italic text-mid">
          Logget ind som {username}
        </p>
      </header>

      <div className="space-y-4">
        <PasswordCard />
        <ExportCard />
        <ImportCard />
        <InfoCard />
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card px-6 py-5">
      <h2 className="mb-4 border-b border-border-light pb-2.5 font-serif text-[20px] font-medium text-accent-bright">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[13px] font-medium text-mid">{children}</label>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: "De to nye adgangskoder matcher ikke." });
      return;
    }
    start(async () => {
      const res = await changePassword({ current, next });
      if (res.ok) {
        setMsg({ ok: true, text: "Adgangskoden er ændret." });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card title="Skift adgangskode">
      <div className="space-y-3">
        <div>
          <Label>Nuværende adgangskode</Label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Ny adgangskode</Label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>Gentag ny adgangskode</Label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !current || !next}
          className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Skifter..." : "Skift adgangskode"}
        </button>
        {msg && (
          <span className={`text-[13px] ${msg.ok ? "text-success" : "text-danger"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </Card>
  );
}

function ExportCard() {
  return (
    <Card title="Eksportér data">
      <p className="mb-4 text-[13px] text-mid">
        Hent en komplet sikkerhedskopi af alle dine data som en JSON-fil — dage,
        projekter, tid, ansøgninger og hændelser. Gem den et sikkert sted.
      </p>
      <a
        href="/api/export"
        download
        className="inline-block cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
      >
        Download backup (.json)
      </a>
    </Card>
  );
}

function ImportCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setMsg(null);
    setPayload(null);
    setFileName(null);
    if (!file) return;
    try {
      const text = await file.text();
      setPayload(JSON.parse(text));
      setFileName(file.name);
    } catch {
      setMsg({ ok: false, text: "Filen kunne ikke læses som JSON." });
    }
  }

  function runImport() {
    if (payload === null) return;
    const confirmed = confirm(
      "Import ERSTATTER alle nuværende data med indholdet af filen. " +
        "Dette kan ikke fortrydes. Har du taget en eksport først?\n\nFortsæt?",
    );
    if (!confirmed) return;
    start(async () => {
      const res = await importData(payload);
      if (res.ok) {
        const total = Object.values(res.counts).reduce((a, b) => a + b, 0);
        setMsg({ ok: true, text: `Importeret: ${total} rækker. Genindlæser...` });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card title="Importér data">
      <p className="mb-4 text-[13px] text-mid">
        Gendan fra en backup-fil.{" "}
        <span className="text-danger">
          Alle nuværende data slettes og erstattes.
        </span>{" "}
        Tag en eksport først.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="!w-auto text-[13px] text-mid file:mr-3 file:cursor-pointer file:rounded-[3px] file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
        />
        <button
          type="button"
          onClick={runImport}
          disabled={pending || payload === null}
          className="cursor-pointer rounded-[3px] border border-danger bg-transparent px-4 py-2 text-[13px] font-medium text-danger hover:bg-[rgba(248,113,113,0.1)] disabled:opacity-40"
        >
          {pending ? "Importerer..." : "Importér og erstat alt"}
        </button>
      </div>
      {fileName && !msg && (
        <p className="mt-2 text-[12px] text-light">Valgt: {fileName}</p>
      )}
      {msg && (
        <p className={`mt-3 text-[13px] ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
    </Card>
  );
}

function InfoCard() {
  return (
    <Card title="Om dine data">
      <div className="space-y-2 text-[13px] text-mid">
        <p>
          Alt gemmes lokalt i <code className="text-accent-bright">data/app.db</code>{" "}
          på din egen PC. Intet sendes til skyen.
        </p>
        <p>
          En enkel rutine: tag en eksport en gang om ugen og læg filen et andet
          sted end på samme drev.
        </p>
      </div>
    </Card>
  );
}
