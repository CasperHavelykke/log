#!/usr/bin/env bash
# Deploy af Loggen på serveren: kode + BEGGE databaser + genstart.
# Kør fra ~/log: ./scripts/deploy.sh
# set -e stopper hårdt hvis et skridt fejler, så vi aldrig står med en
# halvt opdateret instans (fx kode der SELECT'er kolonner DB'en ikke har).
set -euo pipefail

cd "$(dirname "$0")/.."

git pull
npm install
npm run build

# Migrationer på begge databaser — demo-DB'en er blevet glemt to gange.
npm run db:migrate
DATABASE_URL=file:./data-demo/app.db npm run db:migrate

sudo systemctl restart log log-demo
echo "Deploy OK"
