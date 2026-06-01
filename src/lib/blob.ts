import "server-only";

import { del, put } from "@vercel/blob";

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

export async function uploadBlob(params: {
  data: Buffer | Blob | ArrayBuffer;
  prefix: string;
  filename: string;
  contentType: string;
}): Promise<UploadedBlob> {
  const safeName = sanitizeFilename(params.filename);
  const path = `${params.prefix}/${safeName}`;
  const result = await put(path, params.data, {
    access: "private",
    contentType: params.contentType,
    addRandomSuffix: true,
  });
  return {
    url: result.url,
    pathname: result.pathname,
    contentType: params.contentType,
    size:
      params.data instanceof Buffer
        ? params.data.length
        : params.data instanceof Blob
          ? params.data.size
          : params.data.byteLength,
  };
}

export async function deleteBlob(urlOrPathname: string): Promise<void> {
  try {
    await del(urlOrPathname);
  } catch {
    // Hvis blob allerede er væk er det ok.
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
