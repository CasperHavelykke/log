"use client";

import { useRef, useState, useTransition } from "react";
import { changePassword, importData } from "./actions";
import {
  createOAuthClient,
  deleteOAuthClient,
  type CreateResult,
} from "./oauth-actions";

type OAuthClientRow = {
  id: number;
  clientId: string;
  name: string;
  redirectUris: string;
  createdAt: string;
};

export function SettingsPage({
  username,
  initialClients,
}: {
  username: string;
  initialClients: OAuthClientRow[];
}) {
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

  return (
    <Card title="OAuth-clients (Claude-integration)">
      <p className="mb-4 text-[13px] text-mid">
        Hver client har et Client ID og Client Secret. Indtast dem i Claude's
        Custom Connector-dialog — så kan Claude læse og redigere din log via MCP.
      </p>

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
