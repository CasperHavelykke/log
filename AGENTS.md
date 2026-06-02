<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hosting

Web-appen deployes til Vercel; databasen ligger på Turso (libSQL); filer på Vercel Blob.
Det lokale repo bruges som dev-environment — kode-ændringer skubbes til Vercel via git.
Den lokale SQLite-fil (`data/app.db`) er kun til lokal udvikling. Produktion er Turso.

# Kode-stil

- **Ikoner**: brug Lucide-ikoner i UI-komponenter, ikke emojis. Emojis er fine i tekstindhold (placeholders, fri tekst) hvor de er en bevidst del af visningen.
- **Datoer i UI**: brug helpers fra `src/lib/date.ts` (`danishLongDate`, `formatDanishDate`, `danishWeekday`) til alt der vises for brugeren. ISO-format (`YYYY-MM-DD`) bruges kun til DB-storage, URL-parametre og interne keys.
- **UI-tekst**: dansk overalt. Tekniske kommentarer i kode må gerne være engelsk.
- **Mobil-først**: tap-targets mindst 40×40px på mobil, `inputMode="decimal"` til komma-input, ingen `type="number"` til decimaler.
