"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Briefcase, Check, Clock, LogOut, Monitor, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import {
  createOAuthClient,
  deleteOAuthClient,
  type CreateResult,
} from "./oauth-actions";
import { CustomParametersCard } from "./custom-parameters-card";
import type { CustomParamSummary } from "@/lib/custom-parameters";
import {
  startJobSearchPeriod,
} from "../jobs/period-actions";
import type { Theme } from "@/lib/theme";
import { setTheme } from "./theme-actions";
import { formatDanishDate } from "@/lib/date";
import { setFasteEnabled, setGarminSleepEnabled } from "@/lib/user-prefs";
import {
  deleteAccount,
  getAccountSummary,
  type AccountSummary,
} from "./delete-account-actions";

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

type PastPeriodRow = {
  id: number;
  name: string | null;
  startedAt: string;
  endedAt: string;
  applicationCount: number;
};

export function SettingsPage({
  username,
  email,
  initialClients,
  initialCustomParameters,
  initialActivePeriod,
  initialPastPeriods,
  initialFasteEnabled,
  initialGarminSleepEnabled,
  initialTheme,
}: {
  username: string;
  email: string;
  initialClients: OAuthClientRow[];
  initialCustomParameters: CustomParamSummary[];
  initialActivePeriod: ActivePeriodRow | null;
  initialPastPeriods: PastPeriodRow[];
  initialFasteEnabled: boolean;
  initialGarminSleepEnabled: boolean;
  initialTheme: Theme;
}) {
  return (
    <div className="mx-auto max-w-[680px] px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-hair pb-5">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.6px] text-light">
            Indstillinger
          </div>
          <h1 className="font-serif text-[26px] font-medium leading-[1.05] text-ink sm:text-[34px]">
            Logget ind som {username}
          </h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-hair-strong bg-transparent px-3 py-2 text-[13px] text-mid hover:border-danger hover:text-danger"
          >
            <LogOut className="size-4" />
            Log ud
          </button>
        </form>
      </header>

      <div className="space-y-4">
        <ThemeCard initial={initialTheme} />
        <FeaturesCard
          initialFasteEnabled={initialFasteEnabled}
          initialGarminSleepEnabled={initialGarminSleepEnabled}
        />
        <JobSearchCard initial={initialActivePeriod} pastPeriods={initialPastPeriods} />
        <CustomParametersCard initial={initialCustomParameters} />
        <OAuthClientsCard initial={initialClients} />
        <ExportCard />
        <ImportCard />
        <InfoCard />
        <DeleteAccountCard email={email} />
      </div>
    </div>
  );
}

function Card({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 border-b border-hair pb-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-light">
          {label}
        </div>
        {title && (
          <h2 className="mt-0.5 font-serif text-[18px] leading-none text-ink">
            {title}
          </h2>
        )}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.5px] text-light">
      {children}
    </label>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "auto", label: "Auto", icon: Monitor },
  { value: "light", label: "Lys", icon: Sun },
  { value: "dark", label: "Mørk", icon: Moon },
];

function ThemeCard({ initial }: { initial: Theme }) {
  const [theme, setThemeState] = useState<Theme>(initial);
  const [, start] = useTransition();

  function pick(next: Theme) {
    if (next === theme) return;
    const previous = theme;
    setThemeState(next);
    // Optimistisk DOM-opdatering så bytte føles øjeblikkeligt; cookie
    // sættes asynkront og næste navigation bevarer valget.
    if (typeof document !== "undefined") {
      if (next === "auto") {
        const prefersLight =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: light)").matches;
        if (prefersLight) document.documentElement.setAttribute("data-theme", "light");
        else document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", next);
      }
    }
    start(async () => {
      const res = await setTheme(next);
      if (!res.ok) setThemeState(previous);
    });
  }

  return (
    <Card label="Udseende" title="Lys eller mørk">
      <p className="mb-4 text-[13px] text-mid">
        Auto følger din enheds system-præference. Vælg lys eller mørk hvis du
        vil overstyre det.
      </p>
      <div className="inline-flex gap-0.5 rounded-[8px] bg-bg p-0.5">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => pick(opt.value)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                active ? "bg-accent text-white" : "text-mid hover:text-ink"
              }`}
              aria-pressed={active}
            >
              <Icon className="size-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function FeaturesCard({
  initialFasteEnabled,
  initialGarminSleepEnabled,
}: {
  initialFasteEnabled: boolean;
  initialGarminSleepEnabled: boolean;
}) {
  const [fasteEnabled, setFastEnabledState] = useState(initialFasteEnabled);
  const [garminEnabled, setGarminEnabledState] = useState(
    initialGarminSleepEnabled,
  );
  const [, start] = useTransition();

  function toggleFaste() {
    const next = !fasteEnabled;
    setFastEnabledState(next);
    start(async () => {
      await setFasteEnabled(next);
    });
  }

  function toggleGarmin() {
    const next = !garminEnabled;
    setGarminEnabledState(next);
    start(async () => {
      await setGarminSleepEnabled(next);
    });
  }

  return (
    <Card label="Funktioner" title="Aktivér det du bruger">
      <p className="mb-4 text-[13px] text-mid">
        Slå funktioner til/fra. Du kan altid komme tilbage og ændre det.
      </p>

      <div className="space-y-2">
        <FeatureToggle
          icon={<Clock className="size-4" />}
          title="Faste-tracking"
          description="Faste-timer på /today + historik på /helbred"
          enabled={fasteEnabled}
          onToggle={toggleFaste}
        />
        <FeatureToggle
          icon={<Moon className="size-4" />}
          title="Garmin søvndata"
          description="Erstatter manuel søvnkvalitet med Garmin-søvnscore + viser HRV, hvilepuls, SpO₂ m.m. Data hentes fra Garmin Connect i browseren (CSV-eksport) og uploades på /helbred."
          enabled={garminEnabled}
          onToggle={toggleGarmin}
        />
      </div>

      <p className="mt-3 text-[11px] italic text-dim">
        Log er ikke tilknyttet Garmin Ltd. — Garmin og Garmin Connect er
        varemærker tilhørende Garmin Ltd. eller dets datterselskaber.
      </p>
    </Card>
  );
}

function FeatureToggle({
  icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-bg-subtle px-3 py-3 sm:px-4">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-bg)] text-accent">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="text-[12px] text-mid">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${
          enabled
            ? "border-accent bg-accent"
            : "border-hair-strong bg-bg"
        }`}
        aria-pressed={enabled}
      >
        <span
          className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow transition-all ${
            enabled ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function JobSearchCard({
  initial,
  pastPeriods,
}: {
  initial: ActivePeriodRow | null;
  pastPeriods: PastPeriodRow[];
}) {
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

  return (
    <Card label="Jobsøgning" title="Perioder og statistik">
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
        <div className="rounded-[10px] border border-[var(--success-strong)] bg-[var(--success-soft)] p-3">
          <div className="mb-2 flex items-center gap-2 text-[13px]">
            <Briefcase className="size-4 text-success" />
            <span className="font-medium text-ink">
              {active.name || "Aktiv jobsøgningsperiode"}
            </span>
          </div>
          <p className="text-[12px] text-mid">
            Startet {formatDanishDate(active.startedAt)}
          </p>
          <p className="mt-2 text-[11px] italic text-light">
            Afslut perioden fra <strong className="font-medium text-mid">Job</strong>-siden når du har fundet et job.
          </p>
        </div>
      ) : showStart ? (
        <div className="space-y-3 rounded-[10px] bg-bg-subtle p-3">
          <div>
            <Label>
              Navn på perioden{" "}
              <span className="text-[10px] italic text-dim normal-case tracking-normal">— valgfri</span>
            </Label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fx 'Sommer 2026' eller 'Efter studiet'"
              autoFocus
              className="!rounded-[8px] !border-hair !bg-bg"
            />
          </div>
          <div>
            <Label>Start-dato</Label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={todayIso()}
              className="!w-44 !rounded-[8px] !border-hair !bg-bg"
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
              className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Starter…" : "Start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowStart(false);
                setName("");
                setErr(null);
              }}
              className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowStart(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
        >
          <Briefcase className="size-4" />
          Start jobsøgningsperiode
        </button>
      )}

      {pastPeriods.length > 0 && (
        <div className="mt-5 border-t border-hair pt-4">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Afsluttede perioder
          </div>
          <div className="space-y-1.5">
            {pastPeriods.map((p) => (
              <a
                key={p.id}
                href={`/jobs?period=${p.id}`}
                className="flex items-center justify-between gap-3 rounded-[10px] bg-bg-subtle px-3 py-2.5 text-[12px] transition-colors hover:bg-bg"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">
                    {p.name || `Periode fra ${formatDanishDate(p.startedAt)}`}
                  </div>
                  <div className="text-[11px] text-light">
                    {formatDanishDate(p.startedAt)} – {formatDanishDate(p.endedAt)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-serif text-[16px] leading-none text-accent">
                    {p.applicationCount}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.3px] text-light">
                    ansøgn.
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ExportCard() {
  return (
    <Card label="Eksportér data" title="Sikkerhedskopi">
      <p className="mb-4 text-[13px] text-mid">
        Hent en komplet sikkerhedskopi som en ZIP-fil — alle data fra
        databasen samt dine billeder og dokumenter. Gem den et sikkert sted.
      </p>
      <a
        href="/api/export"
        download
        className="inline-block cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright"
      >
        Download backup (.zip)
      </a>
    </Card>
  );
}

function ImportCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function onFile(picked: File | undefined) {
    setMsg(null);
    setFile(picked ?? null);
  }

  function runImport() {
    if (!file) return;
    const confirmed = confirm(
      "Import ERSTATTER alle nuværende data med indholdet af filen. " +
        "Dette kan ikke fortrydes. Har du taget en eksport først?\n\nFortsæt?",
    );
    if (!confirmed) return;
    start(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/import", { method: "POST", body: fd });
        const bodyText = await r.text();
        let parsed:
          | {
              ok: true;
              counts: Record<string, number>;
              filesWritten: number;
            }
          | { ok: false; error: string }
          | null = null;
        if (bodyText) {
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            // ikke JSON — formodentlig HTML-error-page eller proxy-fejl
          }
        }
        if (!r.ok || !parsed) {
          const snippet = bodyText.slice(0, 200) || "(tom respons)";
          setMsg({
            ok: false,
            text: `Server svarede ${r.status} ${r.statusText}: ${snippet}`,
          });
          return;
        }
        if (parsed.ok) {
          const total = Object.values(parsed.counts).reduce((a, b) => a + b, 0);
          const fileNote =
            parsed.filesWritten > 0
              ? ` + ${parsed.filesWritten} fil(er)`
              : "";
          setMsg({
            ok: true,
            text: `Importeret: ${total} rækker${fileNote}. Genindlæser…`,
          });
          setTimeout(() => window.location.reload(), 1200);
        } else {
          setMsg({ ok: false, text: parsed.error });
        }
      } catch (err) {
        setMsg({
          ok: false,
          text: `Upload fejlede: ${err instanceof Error ? err.message : "ukendt fejl"}.`,
        });
      }
    });
  }

  return (
    <Card label="Importér data" title="Gendan fra backup">
      <p className="mb-4 text-[13px] text-mid">
        Gendan fra en backup-fil (ZIP eller JSON).{" "}
        <span className="text-danger">
          Alle nuværende data slettes og erstattes.
        </span>{" "}
        Tag en eksport først.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/zip,.zip,application/json,.json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="!w-auto text-[13px] text-mid file:mr-3 file:cursor-pointer file:rounded-[8px] file:border-0 file:bg-bg-subtle file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
        />
        <button
          type="button"
          onClick={runImport}
          disabled={pending || file === null}
          className="cursor-pointer rounded-[8px] border border-danger bg-transparent px-4 py-2 text-[13px] font-medium text-danger hover:bg-[var(--danger-soft)] disabled:opacity-40"
        >
          {pending ? "Importerer…" : "Importér og erstat alt"}
        </button>
      </div>
      {file && !msg && (
        <p className="mt-2 text-[12px] text-light">
          Valgt: {file.name} ({Math.round(file.size / 1024)} KB)
        </p>
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
    <Card label="Om dine data" title="Hvor ligger det?">
      <div className="space-y-2 text-[13px] text-mid">
        <p>
          Loggen kører på en privat server — ikke i en kommerciel cloud. Trafikken
          går gennem en krypteret tunnel (TLS) og hver bruger har sit eget
          isolerede datasæt. Dataen er <em>ikke</em> end-to-end-krypteret, hvilket
          betyder at server-administratoren teknisk har adgang.
        </p>
        <p>
          Det betyder også, at dataen kun findes ét sted. Tag en eksport en
          gang om måneden og læg JSON-filen et andet sted (ekstern disk, USB,
          krypteret cloud) som backup.
        </p>
      </div>
    </Card>
  );
}

function DeleteAccountCard({ email }: { email: string }) {
  const [step, setStep] = useState<"closed" | "summary" | "confirm">("closed");
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openSummary() {
    setErr(null);
    start(async () => {
      const s = await getAccountSummary();
      setSummary(s);
      setStep("summary");
    });
  }

  function runDelete() {
    setErr(null);
    start(async () => {
      const res = await deleteAccount({ confirmEmail });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      window.location.href = "/login?deleted=1";
    });
  }

  return (
    <section className="rounded-[10px] border border-[var(--danger-strong)] bg-bg-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 border-b border-[var(--danger-strong)] pb-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-danger">
          Permanent handling
        </div>
        <h2 className="mt-0.5 inline-flex items-center gap-2 font-serif text-[18px] leading-none text-ink">
          <AlertTriangle className="size-4 text-danger" />
          Slet konto
        </h2>
      </div>

      <p className="mb-4 text-[13px] text-mid">
        Sletter din bruger og alt tilknyttet data permanent: dagbogsindlæg,
        projekter, ansøgninger, helbredsdata, fotos, dokumenter osv. Kan ikke
        fortrydes. Tag en eksport først hvis du vil beholde dataen.
      </p>

      {step === "closed" && (
        <button
          type="button"
          onClick={openSummary}
          disabled={pending}
          className="cursor-pointer rounded-[8px] border border-danger bg-transparent px-4 py-2 text-[13px] font-medium text-danger hover:bg-[var(--danger-soft)] disabled:opacity-50"
        >
          {pending ? "Indlæser…" : "Slet min konto"}
        </button>
      )}

      {step === "summary" && summary && (
        <div className="rounded-[10px] bg-[var(--danger-soft)] p-3">
          <p className="mb-2 text-[13px] font-medium text-ink">
            Du sletter følgende:
          </p>
          <ul className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-mid">
            <SummaryRow label="Dagbogsindlæg" value={summary.dayEntries} />
            <SummaryRow label="Projekter" value={summary.projects} />
            <SummaryRow label="Tids-poster" value={summary.timeEntries} />
            <SummaryRow label="Ansøgninger" value={summary.jobApplications} />
            <SummaryRow label="Søvn-poster" value={summary.sleepEntries} />
            <SummaryRow label="Faster" value={summary.fasts} />
            <SummaryRow label="Kosttilskud" value={summary.supplements} />
            <SummaryRow label="Trackere" value={summary.trackers} />
            <SummaryRow label="Egne målinger" value={summary.customParameters} />
            <SummaryRow label="Fotos" value={summary.photos} />
            <SummaryRow label="Dokumenter" value={summary.documents} />
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="cursor-pointer rounded-[8px] bg-danger px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
            >
              Fortsæt
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("closed");
                setSummary(null);
              }}
              className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="rounded-[10px] bg-[var(--danger-soft)] p-3">
          <p className="mb-2 text-[13px] text-ink">
            Skriv din email for at bekræfte:
          </p>
          <p className="mb-3 text-[11px] italic text-light">
            {email}
          </p>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="dig@example.com"
            autoComplete="off"
            className="!mb-3 !rounded-[8px] !border-hair !bg-bg !text-[14px]"
          />
          {err && <p className="mb-2 text-[13px] text-danger">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runDelete}
              disabled={pending || !confirmEmail.trim()}
              className="cursor-pointer rounded-[8px] bg-danger px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sletter…" : "Slet min konto permanent"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("summary");
                setConfirmEmail("");
                setErr(null);
              }}
              disabled={pending}
              className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:text-ink"
            >
              Tilbage
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-hair py-0.5">
      <span>{label}</span>
      <span className={`font-medium ${value > 0 ? "text-ink" : "text-dim"}`}>
        {value}
      </span>
    </li>
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
    <Card label="Custom Connector" title="MCP-adgang for AI">
      <p className="mb-4 text-[13px] text-mid">
        Forbind appen til Claude, Mistral eller anden AI-assistent der
        understøtter MCP. Brug URL&apos;en nedenfor som server-adresse, og opret
        derefter en client til at autentificere forbindelsen.
      </p>

      {mcpUrl && (
        <div className="mb-4 rounded-[10px] bg-bg-subtle p-3">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
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
        <div className="mb-4 rounded-[10px] border border-[var(--success-strong)] bg-[var(--success-soft)] p-4">
          <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
            <Check className="size-3.5" />
            Client &quot;{created.name}&quot; oprettet
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
            className="mt-3 cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:text-ink"
          >
            Jeg har kopieret begge — luk
          </button>
        </div>
      )}

      {clients.length === 0 ? (
        <p className="text-[13px] italic text-light">Ingen clients endnu.</p>
      ) : (
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
            Aktive connectors
          </div>
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
                className="rounded-[10px] bg-bg-subtle px-3 py-2.5 text-[12px]"
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0 font-medium text-ink">{c.name}</span>
                  <code className="min-w-0 flex-1 truncate text-mid">
                    {c.clientId}
                  </code>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="shrink-0 cursor-pointer text-dim hover:text-danger"
                    title="Slet"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {uris.length > 0 && (
                  <div className="mt-1 break-all text-[11px] text-light">
                    Redirects: {uris.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {showForm ? (
        <div className="mt-4 space-y-3 rounded-[10px] bg-bg-subtle p-3">
          <div>
            <Label>Navn</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude"
              className="!rounded-[8px] !border-hair !bg-bg"
            />
          </div>
          <div>
            <Label>Redirect URIs (én per linje)</Label>
            <textarea
              value={redirectInput}
              onChange={(e) => setRedirectInput(e.target.value)}
              rows={3}
              placeholder={CLAUDE_REDIRECT_URI}
              className="!w-full !rounded-[8px] !border-hair !bg-bg font-mono text-[12px]"
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
              className="cursor-pointer rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-bright disabled:opacity-50"
            >
              {pending ? "Opretter…" : "Opret"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErr(null);
              }}
              className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] text-mid hover:text-ink"
            >
              Annullér
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-dashed border-hair-strong bg-transparent px-3 py-2 text-[13px] text-light hover:border-accent hover:text-accent"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Opret OAuth-client
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
    <div className="mb-2 flex items-center gap-2 rounded-[8px] bg-bg px-2 py-1.5">
      <span className="w-24 shrink-0 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        {label}
      </span>
      <code className="flex-1 truncate text-[12px] text-ink">{value}</code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[6px] bg-bg-subtle px-2 py-1 text-[11px] text-mid hover:bg-bg-elevated hover:text-ink"
      >
        {copied ? <Check className="size-3 text-success" /> : "Kopiér"}
      </button>
    </div>
  );
}
