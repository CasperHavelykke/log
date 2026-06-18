"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { importData } from "./actions";
import {
  createOAuthClient,
  deleteOAuthClient,
  type CreateResult,
} from "./oauth-actions";
import { CustomParametersCard } from "./custom-parameters-card";
import type { CustomParamSummary } from "@/lib/custom-parameters";
import {
  startJobSearchPeriod,
  endJobSearchPeriod,
} from "../jobs/period-actions";
import { Briefcase } from "lucide-react";
import { formatDanishDate } from "@/lib/date";

type OAuthClientRow = {
  id: number;
  clientId: string;
  name: string;
  redirectUris: string;
  createdAt: string;
};

type ActivePeriodRow = {
  id: number;
  name: string | null;
  startedAt: string;
};

export function SettingsPage({
  username,
  initialClients,
  initialCustomParameters,
  initialActivePeriod,
}: {
  username: string;
  initialClients: OAuthClientRow[];
  initialCustomParameters: CustomParamSummary[];
  initialActivePeriod: ActivePeriodRow | null;
}) {
  return (
    <div className="mx-auto max-w-[680px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="font-serif text-[36px] font-medium leading-none text-ink">
            Indstillinger
          </h1>
          <p className="mt-1 font-serif text-sm italic text-mid">
            Logget ind som {username}
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-border bg-transparent px-3 py-2 text-[13px] text-mid hover:border-danger hover:text-danger"
          >
            <LogOut className="size-4" />
            Log ud
          </button>
        </form>
      </header>

      <div className="space-y-4">
        <JobSearchCard initial={initialActivePeriod} />
        <CustomParametersCard initial={initialCustomParameters} />
        <OAuthClientsCard initial={initialClients} />
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

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function JobSearchCard({ initial }: { initial: ActivePeriodRow | null }) {
  const [active, setActive] = useState(initial);
  const [showStart, setShowStart] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function startNow() {
    setErr(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setErr("Vælg en gyldig start-dato");
      return;
    }
    start(async () => {
      const res = await startJobSearchPeriod({
        name: name.trim() || null,
        startedAt: startDate,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setActive({
        id: res.period.id,
        name: res.period.name,
        startedAt: res.period.startedAt,
      });
      setShowStart(false);
      setName("");
      setStartDate(todayIso());
    });
  }

  function endNow() {
    if (
      !confirm(
        "Afslut den aktive jobsøgningsperiode? Du kan altid se den i historikken bagefter.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await endJobSearchPeriod();
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setActive(null);
    });
  }

  return (
    <Card title="Jobsøgning">
      <div className="mb-3 space-y-2 text-[13px] text-mid">
        <p>
          Aktivér en jobsøgningsperiode når du leder efter job. Når perioden
          kører, kan du:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-[12px]">
          <li>
            Gemme jobopslag, ansøgninger og tilhørende materiale (CV, den
            ansøgning du sendte, kontaktpersoner, noter)
          </li>
          <li>
            Lade AI bruge tidligere ansøgninger som inspiration når du skal
            skrive nye — så de matcher din stil og dine erfaringer
          </li>
          <li>
            Følge statistik for perioden: antal sendt, svar modtaget,
            interviews, afvisninger og tilbud — samlet ét sted
          </li>
        </ul>
        <p className="text-[12px] italic text-light">
          Når du afslutter perioden, gemmes alt som historik. Næste gang du
          starter en ny periode er det &quot;ren tavle&quot;, men du kan altid
          kigge tilbage.
        </p>
      </div>

      {active ? (
        <div className="rounded-[3px] border border-success bg-[rgba(74,222,128,0.06)] p-3">
          <div className="mb-2 flex items-center gap-2 text-[13px]">
            <Briefcase className="size-4 text-success" />
            <span className="font-medium text-ink">
              {active.name || "Aktiv jobsøgningsperiode"}
            </span>
          </div>
          <p className="mb-3 text-[12px] text-mid">
            Startet {formatDanishDate(active.startedAt)}
          </p>
          <button
            type="button"
            onClick={endNow}
            disabled={pending}
            className="cursor-pointer rounded-[3px] border border-danger bg-transparent px-3 py-1.5 text-[12px] font-medium text-danger hover:bg-[rgba(248,113,113,0.08)] disabled:opacity-50"
          >
            {pending ? "Afslutter..." : "Afslut periode"}
          </button>
        </div>
      ) : showStart ? (
        <div className="space-y-3 rounded-[3px] border border-border-light bg-bg p-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-mid">
              Navn på perioden{" "}
              <span className="text-[10px] italic text-dim">— valgfri</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fx 'Sommer 2026' eller 'Efter studiet'"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-mid">
              Start-dato
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={todayIso()}
              className="!w-44"
            />
            <p className="mt-1 text-[11px] italic text-dim">
              Vælg en tidligere dato hvis du allerede er begyndt at søge —
              ansøgninger med sentAt i intervallet bliver automatisk talt med.
            </p>
          </div>
          {err && <p className="text-[13px] text-danger">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startNow}
              disabled={pending}
              className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Starter..." : "Start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowStart(false);
                setName("");
                setErr(null);
              }}
              className="cursor-pointer text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowStart(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Briefcase className="size-4" />
          Start jobsøgningsperiode
        </button>
      )}
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
          Dataen ligger i Turso (libSQL), hosted i Frankfurt-regionen. Appen
          deployes til Vercel. Begge er kommercielle hostere — drifts-personale
          har teknisk adgang. Det er ikke E2E-krypteret.
        </p>
        <p>
          En god rutine: tag en eksport en gang om måneden og læg filen lokalt
          på din egen disk som ekstra sikkerhed.
        </p>
      </div>
    </Card>
  );
}

const CLAUDE_REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";

function OAuthClientsCard({ initial }: { initial: OAuthClientRow[] }) {
  const [clients, setClients] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("Claude");
  const [redirectInput, setRedirectInput] = useState(CLAUDE_REDIRECT_URI);
  const [created, setCreated] = useState<{
    clientId: string;
    clientSecret: string;
    name: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setErr(null);
    const redirects = redirectInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (redirects.length === 0) {
      setErr("Mindst én redirect URI er påkrævet.");
      return;
    }
    start(async () => {
      const res: CreateResult = await createOAuthClient({
        name: name.trim(),
        redirectUris: redirects,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setCreated({
        clientId: res.clientId,
        clientSecret: res.clientSecret,
        name: res.name,
      });
      // Append to list — without secret
      setClients((prev) => [
        ...prev,
        {
          id: Math.max(0, ...prev.map((c) => c.id)) + 1,
          clientId: res.clientId,
          name: res.name,
          redirectUris: JSON.stringify(redirects),
          createdAt: new Date().toISOString(),
        },
      ]);
      setShowForm(false);
      setName("Claude");
      setRedirectInput(CLAUDE_REDIRECT_URI);
    });
  }

  function remove(id: number) {
    if (!confirm("Slet denne OAuth-client? Eksisterende access tokens udløber straks.")) {
      return;
    }
    start(async () => {
      await deleteOAuthClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
    });
  }

  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const mcpUrl = origin ? `${origin}/api/mcp` : null;

  return (
    <Card title="Custom Connector">
      <p className="mb-4 text-[13px] text-mid">
        Forbind appen til Claude, Mistral eller anden AI-assistent der
        understøtter MCP. Brug URL'en nedenfor som server-adresse, og opret
        derefter en client til at autentificere forbindelsen.
      </p>

      {mcpUrl && (
        <div className="mb-4 rounded-[3px] border border-border-light bg-bg p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.5px] text-light">
            Server URL
          </div>
          <CredentialLine label="URL" value={mcpUrl} />
          <p className="mt-2 text-[11px] italic text-dim">
            Indtast denne URL i din AI-assistent under &quot;Custom Connector&quot; eller
            &quot;MCP server URL&quot;. Du bliver derefter sendt tilbage til denne app
            for at logge ind og godkende adgangen.
          </p>
        </div>
      )}

      {created && (
        <div className="mb-4 rounded-[3px] border border-success bg-[rgba(74,222,128,0.08)] p-4">
          <p className="mb-3 text-[13px] font-medium text-success">
            ✓ Client &quot;{created.name}&quot; oprettet
          </p>
          <p className="mb-3 text-[12px] italic text-warning">
            Client Secret vises kun nu. Kopier det med det samme — det kan ikke
            hentes igen.
          </p>
          <CredentialLine label="Client ID" value={created.clientId} />
          <CredentialLine label="Client Secret" value={created.clientSecret} />
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="mt-3 cursor-pointer text-[12px] text-mid hover:text-ink"
          >
            Jeg har kopieret begge — luk
          </button>
        </div>
      )}

      {clients.length === 0 ? (
        <p className="text-[13px] italic text-light">Ingen clients endnu.</p>
      ) : (
        <div className="space-y-1.5">
          {clients.map((c) => {
            const uris = (() => {
              try {
                const arr = JSON.parse(c.redirectUris);
                return Array.isArray(arr) ? arr : [];
              } catch {
                return [];
              }
            })();
            return (
              <div
                key={c.id}
                className="rounded-[3px] border border-border-light bg-bg px-3 py-2 text-[12px]"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink">{c.name}</span>
                  <code className="text-mid">{c.clientId}</code>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="ml-auto cursor-pointer text-dim hover:text-danger"
                  >
                    Slet
                  </button>
                </div>
                {uris.length > 0 && (
                  <div className="mt-1 text-[11px] text-light">
                    Redirects: {uris.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="mt-4 space-y-3 rounded-[3px] border border-border-light bg-bg p-3">
          <div>
            <Label>Navn</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude"
            />
          </div>
          <div>
            <Label>Redirect URIs (én per linje)</Label>
            <textarea
              value={redirectInput}
              onChange={(e) => setRedirectInput(e.target.value)}
              rows={3}
              placeholder={CLAUDE_REDIRECT_URI}
              className="!w-full font-mono text-[12px]"
            />
            <p className="mt-1 text-[11px] text-light">
              For claude.ai web: {CLAUDE_REDIRECT_URI}
            </p>
          </div>
          {err && <p className="text-[13px] text-danger">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !name.trim()}
              className="cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Opretter..." : "Opret"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErr(null);
              }}
              className="cursor-pointer text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 cursor-pointer rounded-[3px] border border-dashed border-border bg-transparent px-3 py-2 text-[13px] text-light hover:border-accent hover:text-accent-bright"
        >
          + Opret OAuth-client
        </button>
      )}
    </Card>
  );
}

function CredentialLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="mb-2 flex items-center gap-2 rounded-[3px] border border-border-light bg-bg px-2 py-1.5">
      <span className="w-24 shrink-0 text-[11px] uppercase tracking-[0.5px] text-light">
        {label}
      </span>
      <code className="flex-1 truncate text-[12px] text-ink">{value}</code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 cursor-pointer rounded-[2px] border border-border px-2 py-0.5 text-[11px] text-mid hover:border-accent hover:text-accent-bright"
      >
        {copied ? "✓" : "Kopiér"}
      </button>
    </div>
  );
}
