#!/bin/bash
# Natligt demo-reset (kl. 04 via loggen-demo-reset.timer).
#
# Demoen bygges FRISK af migrationer + seed-scriptet — IKKE af et
# fastfrosset snapshot. Det gamle app.golden.db-setup rullede skemaet
# tilbage hver nat og knækkede demoen morgenen efter enhver deploy med
# migrationer ("no such column: training_enabled", oktober 2026).
# Seedet vedligeholdes for hver feature, så det ER den gyldne kilde.
#
# Installeres på serveren med:
#   sudo cp ~/log/scripts/demo-reset.sh /usr/local/bin/loggen-demo-reset
#   sudo chmod +x /usr/local/bin/loggen-demo-reset
set -euo pipefail

systemctl stop log-demo
cd /home/casper/log

# Eksplicitte stier — intet glob, der kunne ramme andre filer.
rm -f data-demo/app.db data-demo/app.db-wal data-demo/app.db-shm
rm -rf data-demo/photos data-demo/documents data-demo/recipes

# Kør node-delene som casper, så filerne ikke ejes af root (log-demo
# kører som casper og skal kunne skrive i databasen).
runuser -u casper -- env DATABASE_URL=file:./data-demo/app.db npm run db:migrate
runuser -u casper -- env DATABASE_URL=file:./data-demo/app.db npx tsx scripts/seed-demo.ts

systemctl start log-demo
