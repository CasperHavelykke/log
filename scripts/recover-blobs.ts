/**
 * Genskab DB-referencer til alle blobs i Vercel Blob storage efter at
 * cascade-delete ramte photos + documents-tabellerne.
 *
 * Filerne er stadig i Blob storage — kun rows i DB blev slettet. Dette
 * script lister alle blobs og genskaber rows med best-effort metadata.
 *
 * Mistede metadata (sættes til defaults):
 *   - photo.category → "other" (du kan re-kategorisere i appen)
 *   - photo.bodyArea, caption → null
 *   - photo.takenAt → uploadedAt fra blob
 *   - document.kind → "other"
 *   - document.title → filnavnet fra pathname
 *   - document.extractedText → null
 *   - document.jobApplicationId → null
 *
 * Idempotent — springer over blobs der allerede har en row.
 *
 * Brug:
 *   $env:TURSO_DATABASE_URL = "libsql://..."
 *   $env:TURSO_AUTH_TOKEN = "..."
 *   $env:BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_..."
 *   $env:RECOVER_USER_ID = "1"
 *   npx tsx scripts/recover-blobs.ts
 */
import { createClient } from "@libsql/client";
import { list } from "@vercel/blob";

function guessMime(pathname: string): string {
  const ext = pathname.toLowerCase().slice(pathname.lastIndexOf("."));
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".html":
    case ".htm":
      return "text/html";
    default:
      return "application/octet-stream";
  }
}

function pathnameToTitle(pathname: string): string {
  // photos/min-arm-2024-abc123.jpg → "min-arm-2024"
  const filename = pathname.split("/").pop() ?? pathname;
  const stem = filename.slice(0, filename.lastIndexOf("."));
  // Drop random suffix (typisk -abc123 i slutningen)
  return stem.replace(/-[a-z0-9]{6,}$/, "").replace(/-/g, " ") || filename;
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const userIdRaw = process.env.RECOVER_USER_ID;

  if (!blobToken) {
    console.error("BLOB_READ_WRITE_TOKEN mangler");
    process.exit(1);
  }
  if (!userIdRaw) {
    console.error("RECOVER_USER_ID mangler (fx '1')");
    process.exit(1);
  }
  const userId = Number(userIdRaw);

  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  console.log("Lister blobs fra Vercel Blob storage...");
  const allBlobs: Array<{
    url: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
  }> = [];

  let cursor: string | undefined;
  let pages = 0;
  do {
    const result = await list({ token: blobToken, cursor, limit: 1000 });
    allBlobs.push(...result.blobs);
    cursor = result.cursor;
    pages++;
    console.log(`  side ${pages}: ${result.blobs.length} blobs`);
  } while (cursor);

  console.log(`\nFundet ${allBlobs.length} blobs total\n`);

  const photos = allBlobs.filter((b) => b.pathname.startsWith("photos/"));
  const documents = allBlobs.filter((b) => b.pathname.startsWith("documents/"));
  const other = allBlobs.filter(
    (b) =>
      !b.pathname.startsWith("photos/") && !b.pathname.startsWith("documents/"),
  );

  console.log(`Photos: ${photos.length}`);
  console.log(`Documents: ${documents.length}`);
  if (other.length > 0) {
    console.log(`Andre blobs (ignoreres): ${other.length}`);
  }
  console.log();

  // Eksisterende rækker — for at undgå duplikater
  const existingPhotos = new Set<string>(
    (
      await client.execute({
        sql: "SELECT blob_pathname FROM photos WHERE user_id = ?",
        args: [userId],
      })
    ).rows.map((r) => r.blob_pathname as string),
  );
  const existingDocs = new Set<string>(
    (
      await client.execute({
        sql: "SELECT blob_pathname FROM documents WHERE user_id = ?",
        args: [userId],
      })
    ).rows.map((r) => r.blob_pathname as string),
  );

  // --- Recover photos ---
  let photosCreated = 0;
  for (const blob of photos) {
    if (existingPhotos.has(blob.pathname)) continue;
    const mime = guessMime(blob.pathname);
    // Schema forventer YYYY-MM-DD, ikke fuld ISO-timestamp.
    const takenAt = new Date(blob.uploadedAt).toISOString().slice(0, 10);
    const caption = pathnameToTitle(blob.pathname);
    await client.execute({
      sql: `INSERT INTO photos
              (user_id, tracker_id, category, body_area, caption,
               blob_url, blob_pathname, mime_type, size_bytes, taken_at)
            VALUES (?, NULL, 'other', NULL, ?, ?, ?, ?, ?, ?)`,
      args: [
        userId,
        caption,
        blob.url,
        blob.pathname,
        mime,
        blob.size,
        takenAt,
      ],
    });
    photosCreated++;
  }
  console.log(`✓ Photos recovered: ${photosCreated} (${existingPhotos.size} eksisterede allerede)`);

  // --- Recover documents ---
  let docsCreated = 0;
  for (const blob of documents) {
    if (existingDocs.has(blob.pathname)) continue;
    const mime = guessMime(blob.pathname);
    const filename = blob.pathname.split("/").pop() ?? blob.pathname;
    const title = pathnameToTitle(blob.pathname);
    await client.execute({
      sql: `INSERT INTO documents
              (user_id, kind, title, filename, blob_url, blob_pathname,
               mime_type, size_bytes, extracted_text, job_application_id)
            VALUES (?, 'other', ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      args: [
        userId,
        title,
        filename,
        blob.url,
        blob.pathname,
        mime,
        blob.size,
      ],
    });
    docsCreated++;
  }
  console.log(`✓ Documents recovered: ${docsCreated} (${existingDocs.size} eksisterede allerede)`);

  console.log("\n✓ Færdig. Du kan re-kategorisere photos + documents i appen.");
  client.close();
}

main().catch((e) => {
  console.error("FEJL:", e);
  process.exit(1);
});
