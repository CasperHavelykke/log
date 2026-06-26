# Loggen

Personlig dashboard til daglige aktiviteter, projekter, jobansøgninger og
helbred. Selvhostet på `loggen.app` — egen Ubuntu-server, egen SQLite-fil, egne
disk-filer. Ingen tredjepart med teknisk adgang til data.

> ## ⚠️ Repoet ligger på `F:\ikke-synkroniseret\`
>
> Mappen ligger med vilje uden for cloud-sync. Lokalt arbejde er fint;
> push sker til den private GitHub-remote der bruges som deploy-kanal til
> hjem-serveren. Tilføj **aldrig** offentlige remotes eller fork repoet —
> alt indhold er personligt.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- SQLite via libSQL-driver, Drizzle ORM
- Tailwind v4, Lucide-ikoner, DM Sans + EB Garamond
- Auth.js m. magic-link (Resend)
- OAuth 2.0 for MCP-clients
- Recharts (statistik), Sharp (icon-gen), fflate (ZIP-backup)
- Selvhostet på Ubuntu 26.04 + Caddy + Let's Encrypt + systemd

## Sider

`/` dashboard, `/today` (I dag), `/jobs`, `/projects` (Projekter),
`/health` (Helbred), `/statistik`, `/journal`, `/documents`,
`/indstillinger`.

## Lokal udvikling

`next dev` køres **aldrig** for dette projekt — det hænger PC'en. Verificér
i stedet med:

```bash
npm install
npx tsc --noEmit         # type-check
npm run build            # produktions-build (når du vil være sikker)
```

Database-schema-ændringer:

```bash
npm run db:generate      # genererer migration ud fra schema.ts
npm run db:migrate       # anvender migrationen
```

## Deploy

Repoet pushes til den private GitHub-remote (`origin/main`). På serveren:

```bash
cd ~/log && git pull && npm install && npm run build && sudo systemctl restart log
```

Service-navnet er `log.service` (systemd). Caddy står foran med TLS.

## Datalagring

Alt under `data/`:

- `data/app.db` — SQLite-databasen
- `data/photos/` — foto-filer (tracker-billeder)
- `data/documents/` — uploadede CV/ansøgninger/job-opslag

**Backup**: Hent en ZIP via `/indstillinger → Eksportér data`. Den
indeholder hele DB'en + alle filer + en `README.txt`. Læg en kopi et
andet sted (eksternt drev, krypteret cloud) — dataen findes kun ét sted nu.

Import samme sted: ZIP eller JSON erstatter al nuværende data.

## MCP — AI-adgang

Appen eksponerer en MCP-server på `/api/mcp` med OAuth 2.0. Forbind Claude
(eller anden MCP-klient) via Custom Connector:

1. Indtast `https://loggen.app/api/mcp` som server-URL.
2. Opret en OAuth-client via `/indstillinger → Custom Connector` →
   indtast Client ID + Secret i Claude.
3. Godkend adgang via magic-link-login.

AI får så ~25 værktøjer (læsning + skrivning på dage, projekter, jobs,
fotos, dokumenter, kosttilskud, ugemål osv.).

## Sikkerhed

Enkelt-brugers app — ingen registrering. Auth via Auth.js magic-link
(Resend transport). Sessions er DB-baserede så de kan revokes. UFW + SSH
key-auth + LUKS+LVM på serveren. Datatrafikken går gennem TLS (Let's
Encrypt). Dataen er **ikke** end-to-end-krypteret — server-administrator
(dig selv) har teknisk DB-adgang.
