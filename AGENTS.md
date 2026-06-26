<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hosting

Web-appen er selvhostet på en privat Ubuntu-server (ThinkCentre M920q): Next.js
kører som systemd-service `log`, Caddy står foran med TLS, libSQL kører lokalt
på filen `data/app.db`, og fotos + dokumenter ligger som filer under `data/`.
Det lokale repo bruges som dev-environment — `next dev` køres aldrig her,
men ændringer pulles til serveren via `git pull && npm install && npm run
build && sudo systemctl restart log`.

# Kode-stil

- **Ikoner**: brug Lucide-ikoner i UI-komponenter, ikke emojis. Emojis er fine i tekstindhold (placeholders, fri tekst) hvor de er en bevidst del af visningen.
- **Datoer i UI**: brug helpers fra `src/lib/date.ts` (`danishLongDate`, `formatDanishDate`, `danishWeekday`) til alt der vises for brugeren. ISO-format (`YYYY-MM-DD`) bruges kun til DB-storage, URL-parametre og interne keys.
- **UI-tekst**: dansk overalt. Tekniske kommentarer i kode må gerne være engelsk.
- **Mobil-først**: tap-targets mindst 40×40px på mobil, `inputMode="decimal"` til komma-input, ingen `type="number"` til decimaler.
