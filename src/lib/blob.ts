import "server-only";

import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";

export const PHOTO_PREFIX = "photos";
export const DOCUMENT_PREFIX = "documents";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/html",
  "text/markdown",
];

export type UploadedBlob = {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
};

// Lokal disk-rod for alle uploads. Ligger i samme data/ som SQLite-filen.
// DATA_DIR-env kan pege den et andet sted hen (demo-instansen bruger
// data-demo/ så demo-uploads aldrig blandes med rigtige filer).
const BLOB_ROOT = resolve(process.cwd(), process.env.DATA_DIR ?? "data");

function blobAbsolutePath(relativePath: string): string {
  return join(BLOB_ROOT, relativePath);
}

export async function uploadBlob(params: {
  data: Buffer | Blob | ArrayBuffer;
  prefix: string;
  filename: string;
  contentType: string;
}): Promise<UploadedBlob> {
  const safeName = sanitizeFilename(params.filename);
  const suffix = randomBytes(8).toString("hex");
  const dot = safeName.lastIndexOf(".");
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  const ext = dot > 0 ? safeName.slice(dot) : "";
  const finalName = `${stem}-${suffix}${ext}`;

  const relativePath = `${params.prefix}/${finalName}`;
  const absolutePath = blobAbsolutePath(relativePath);

  await mkdir(dirname(absolutePath), { recursive: true });

  let buffer: Buffer;
  if (params.data instanceof Buffer) {
    buffer = params.data;
  } else if (params.data instanceof Blob) {
    const arr = await params.data.arrayBuffer();
    buffer = Buffer.from(new Uint8Array(arr));
  } else {
    buffer = Buffer.from(new Uint8Array(params.data));
  }

  await writeFile(absolutePath, buffer);

  return {
    url: relativePath,
    pathname: relativePath,
    contentType: params.contentType,
    size: buffer.length,
  };
}

export async function deleteBlob(pathname: string): Promise<void> {
  try {
    await unlink(blobAbsolutePath(pathname));
  } catch {
    // Allerede væk — ok
  }
}

export async function getBlobStream(pathname: string): Promise<{
  stream: ReadableStream<Uint8Array> | null;
  contentLength?: number;
}> {
  const absolutePath = blobAbsolutePath(pathname);
  try {
    const stats = await stat(absolutePath);
    const nodeStream = createReadStream(absolutePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return { stream: webStream, contentLength: stats.size };
  } catch {
    return { stream: null };
  }
}

function sanitizeFilename(name: string): string {
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
