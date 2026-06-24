#!/usr/bin/env node
// Engangsmigration: hent alle billeder + dokumenter fra Vercel Blob ned til
// lokal data/photos/ og data/documents/, opdatér DB-rows til relative stier.
// Backwards-compat: route.ts og blob.ts håndterer både http:// (gamle) og
// relative stier (nye), så det er trygt at køre uden downtime.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { get as vercelGet } from "@vercel/blob";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
      ];
    }),
);

if (!env.BLOB_READ_WRITE_TOKEN) {
  console.error("ERROR: BLOB_READ_WRITE_TOKEN mangler i .env — kan ikke hente fra Vercel Blob");
  process.exit(1);
}
process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN;

const db = createClient({
  url: env.DATABASE_URL ?? "file:./data/app.db",
});

const BLOB_ROOT = resolve(process.cwd(), "data");

function sanitizeFilename(name) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const cleanStem = stem
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const cleanExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${cleanStem || "file"}${cleanExt}`;
}

function extensionFor(mime) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "application/pdf") return ".pdf";
  if (mime === "text/plain") return ".txt";
  if (mime === "text/html") return ".html";
  if (mime === "text/markdown") return ".md";
  if (mime?.includes("wordprocessingml")) return ".docx";
  return "";
}

async function migrateRows(tableName, prefix, fileLabelFn) {
  console.log(`\n=== ${tableName} ===`);
  const rows = await db.execute(
    `SELECT * FROM ${tableName} WHERE blob_url LIKE 'http%'`,
  );
  console.log(`${rows.rows.length} rows skal migreres`);

  for (const row of rows.rows) {
    const id = Number(row.id);
    const userId = Number(row.user_id);
    const oldUrl = String(row.blob_url);
    const mime = String(row.mime_type);
    const ext = extensionFor(mime);

    try {
      // Hent fra Vercel Blob
      const result = await vercelGet(oldUrl, { access: "private" });
      if (!result || result.statusCode !== 200) {
        console.error(`  ✗ ${tableName}#${id}: kunne ikke hente fra Vercel (status ${result?.statusCode})`);
        continue;
      }

      // Til Buffer
      const chunks = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));

      // Lav lokal sti
      const suffix = randomBytes(8).toString("hex");
      const baseLabel = fileLabelFn(row);
      const filename = `${sanitizeFilename(baseLabel)}-${suffix}${ext}`;
      const relativePath = `${prefix}/${userId}/${filename}`;
      const absolutePath = join(BLOB_ROOT, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, buffer);

      // Opdatér DB
      await db.execute({
        sql: `UPDATE ${tableName} SET blob_url = ?, blob_pathname = ? WHERE id = ?`,
        args: [relativePath, relativePath, id],
      });

      console.log(`  ✓ ${tableName}#${id} → ${relativePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`  ✗ ${tableName}#${id}: ${err.message}`);
    }
  }
}

await migrateRows("photos", "photos", (r) => `photo-${r.id}`);
await migrateRows("documents", "documents", (r) =>
  String(r.filename ?? `doc-${r.id}`).replace(/\.[^.]+$/, ""),
);

console.log("\n✓ Blob-migration komplet. Test appen, derefter kan Vercel Blob-instansen decommissionses.");
