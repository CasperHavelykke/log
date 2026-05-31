<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hosting

Web-appen deployes til Vercel; databasen ligger på Turso (libSQL); filer på Vercel Blob.
Det lokale repo bruges som dev-environment — kode-ændringer skubbes til Vercel via git.
Den lokale SQLite-fil (`data/app.db`) er kun til lokal udvikling. Produktion er Turso.
