# Demo-instans (demo.loggen.app)

Åben, login-fri demo af Loggen med fiktiv data. Samme kodebase og samme
`.next`-build som produktion — kun miljøvariabler adskiller de to instanser,
så deploy er stadig ét `git pull && npm install && npm run build`, efterfulgt
af genstart af **begge** services.

## Sådan virker demo-mode

`DEMO_MODE=1` (læses ved runtime, aldrig ved build):

- Alle besøgende er automatisk demo-brugeren (`demo@loggen.app`) — intet login
- Egen database (`DATABASE_URL`) og egen fil-mappe (`DATA_DIR`)
- Blokeret: magic-link-afsendelse, import/eksport, slet konto,
  OAuth-clients, MCP-endpointet og alle fil-uploads
- Banner øverst: "Demo — … nulstilles automatisk"
- Skrivning i øvrigt tilladt (dagslog, opskrifter osv.) — nulstilles af timer

## Førstegangsopsætning på serveren

### 1. Demo-database + seed

```bash
cd ~/log
mkdir -p data-demo
DATABASE_URL=file:./data-demo/app.db npx drizzle-kit push --force
DATABASE_URL=file:./data-demo/app.db npx tsx scripts/apply-migrations.ts --backfill-through 29
DATABASE_URL=file:./data-demo/app.db npx tsx scripts/seed-demo.ts
# Golden kopi som reset-timeren ruller tilbage til:
cp data-demo/app.db data-demo/app.golden.db
```

(`--backfill-through 29` = seneste migrations-idx pt. Fremtidige migrationer
anvendes normalt med `DATABASE_URL=file:./data-demo/app.db npm run db:migrate`.)

### 2. systemd-service: `/etc/systemd/system/log-demo.service`

```ini
[Unit]
Description=Loggen demo-instans
After=network.target

[Service]
Type=simple
User=casper
WorkingDirectory=/home/casper/log
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DEMO_MODE=1
Environment=DATABASE_URL=file:./data-demo/app.db
Environment=DATA_DIR=data-demo
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now log-demo
```

### 3. Caddy: tilføj blok i `/etc/caddy/Caddyfile`

```
demo.loggen.app {
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
```

### 4. DNS (Simply.com)

A-record: `demo.loggen.app` → samme IP som `loggen.app`. Tilføj også
`demo` i DynDNS-scriptets record-liste (`/etc/loggen-ddns/config` /
`/usr/local/bin/loggen-ddns-update`), så den følger med ved IP-skift.

### 5. Natlig nulstilling

`/usr/local/bin/loggen-demo-reset`:

```bash
#!/bin/bash
set -e
systemctl stop log-demo
cd /home/casper/log
cp data-demo/app.golden.db data-demo/app.db
rm -rf data-demo/photos data-demo/documents data-demo/recipes
systemctl start log-demo
```

`/etc/systemd/system/loggen-demo-reset.service`:

```ini
[Unit]
Description=Nulstil Loggen-demoen til golden seed

[Service]
Type=oneshot
ExecStart=/usr/local/bin/loggen-demo-reset
```

`/etc/systemd/system/loggen-demo-reset.timer`:

```ini
[Unit]
Description=Natlig nulstilling af Loggen-demoen

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo chmod +x /usr/local/bin/loggen-demo-reset
sudo systemctl daemon-reload
sudo systemctl enable --now loggen-demo-reset.timer
```

## Deploy fremover

```bash
cd ~/log && git pull && npm install && npm run build \
  && sudo systemctl restart log log-demo
```

Ved nye migrationer køres de mod BEGGE databaser før genstart:

```bash
npm run db:migrate
DATABASE_URL=file:./data-demo/app.db npm run db:migrate
# Genopfrisk golden-kopien hvis skemaet ændrede sig:
DATABASE_URL=file:./data-demo/app.db npx tsx scripts/seed-demo.ts
cp data-demo/app.db data-demo/app.golden.db
```
