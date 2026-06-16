# Log

Personlig logbog til daglige aktiviteter, projekter, jobansøgninger og helbred.
Kører lokalt på din PC. Ingen cloud, ingen tredjeparter — alt ligger i en SQLite-fil
i `data/app.db`.

> ## ❌ Dette projekt må aldrig pushes til GitHub eller andre remotes
>
> Repoet indeholder personlig helbreds- og jobsøgningsdata og ligger med
> vilje på `F:\ikke-synkroniseret\` (uden for cloud-sync). Det er bygget
> som lokal-kun, og data hører ikke hjemme på en offentlig — eller for
> den sags skyld privat — remote.
>
> Push aldrig. Tilføj aldrig en `origin`. Hvis du har brug for versioning,
> så hold det lokalt (`git log`, lokale branches er fine).

## Stak

- Next.js 16 (App Router) + React 19 + TypeScript
- SQLite via `better-sqlite3`, Drizzle ORM
- Tailwind v4
- Egen session-baseret auth (bcrypt + signed cookies)

## Førstegangsopsætning

Dobbeltklik `setup.bat` — det installerer afhængigheder og kører migrationer.
Du skal selv tilføje `.env.local` med `AUTH_SECRET` og `AUTH_RESEND_KEY` og logge
ind via magic link på `/login` første gang.

Alternativt manuelt:

```bash
npm install
npx tsx scripts/ensure-auth-schema.ts
```

## Daglig brug

Dobbeltklik `start.bat`. Appen åbnes i din browser på
[http://localhost:3000](http://localhost:3000).

Serveren binder også til dit lokale netværk på port 3000, så du kan logge ind fra
din telefon på samme WiFi. Find PC'ens IP med `ipconfig` (fx
`192.168.1.42`) og åbn `http://192.168.1.42:3000` på telefonen.

For at lukke serveren: tryk `Ctrl+C` i terminalvinduet.

## Udvikling

```bash
npm run dev          # hot-reload dev-server
npm run db:studio    # database GUI i browseren
```

Når schemaet ændres:

```bash
npm run db:generate  # genererer ny migration ud fra schema.ts
npm run db:migrate   # anvender migrationen på app.db
```

## Datalagring

Alt ligger i `data/app.db`. Tag jævnligt en kopi af den fil til et sikkert sted —
det er hele din historik.

## Claude Desktop-integration (MCP)

Appen kommer med en lokal MCP-server der lader Claude Desktop læse og skrive i din
logbog. Claude starter automatisk serveren når den skal bruge den.

### Opsætning

1. Åbn `%APPDATA%\Claude\claude_desktop_config.json` i en editor.
   (Fra Stifinder: skriv `%APPDATA%\Claude` i adressefeltet. Hvis filen ikke
   findes, opret den med indholdet nedenfor.)

2. Tilføj denne sektion (flet ind hvis du allerede har andre `mcpServers`).
   Absolutte stier bruges, så det ikke afhænger af PATH eller hvilken Node-version
   der er aktiv i terminalen:

   ```json
   {
     "mcpServers": {
       "dagbog": {
         "command": "C:\\Program Files\\nodejs\\node.exe",
         "args": [
           "F:\\ikke-synkroniseret\\log\\node_modules\\tsx\\dist\\cli.mjs",
           "F:\\ikke-synkroniseret\\log\\src\\mcp\\server.ts"
         ],
         "cwd": "F:\\ikke-synkroniseret\\log"
       }
     }
   }
   ```

3. Genstart Claude Desktop helt (afslut fra system-trayen, ikke bare luk vinduet).

4. I en ny samtale skulle "dagbog" nu være tilgængelig som connector. Prøv at
   spørge fx *"Hvad har jeg skrevet i min logbog i dag?"* eller *"Log at jeg har
   haft hovedpine 6/10 i dag"*.

### Værktøjer Claude har til rådighed

| Værktøj | Hvad det gør |
|---|---|
| `get_day_entry` | Henter logbog for en bestemt dag (standard: i dag) |
| `list_day_entries` | Henter en datointerval — fx hele ugen |
| `health_summary` | Aggregerer hovedpine, søvn, humør, energi over N dage |
| `upsert_day_entry` | Skriver/opdaterer felter for en bestemt dag |

Du kan også teste serveren manuelt fra terminal med `npm run mcp` — den lytter
på stdin og taler MCP-protokollen (mest interessant under fejlfinding).

### Sikkerhed

MCP-serveren kører kun lokalt og kommunikerer kun gennem den proces Claude
Desktop selv starter. Den lytter ikke på noget netværk og kan kun tilgå din
SQLite-fil. Hvis du vil deaktivere den, fjern blot `dagbog`-sektionen fra
Claude Desktop-konfigurationen.

## Hvad er bygget indtil videre

- Fase 1: Auth, login, beskyttede ruter, app-layout
- Fase 2: "I dag"-siden med daglig helbredslog (hovedpine, søvn, humør, energi)
  og dagsnotater
- Fase 3: Ny mørk UI (DM Sans + EB Garamond), ugemål-banner, jobansøgninger med
  status-livscyklus, fokus-projekt med tidsregistrering, refleksionsfelter
  (hvad gik godt, næste skridt)
- MCP-server til Claude Desktop med 16 værktøjer dækkende dagslog, ugemål,
  projekter, tidsregistrering og jobansøgninger

Kommende faser: jobansøgninger, projekter + tidsregistrering, helbredskalender,
journal-søgning, dashboard, backup/restore.
