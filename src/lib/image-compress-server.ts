import "server-only";

import sharp from "sharp";

export type ServerCompressed = {
  buffer: Buffer;
  bytes: number;
  width: number;
  height: number;
  mimeType: "image/jpeg";
  attempts: number;
};

// Samme target og fallback-trin som klient-side image-compress.ts —
// gør AI-uploads ensartede med manuelle uploads.
const TARGET_BYTES = 500 * 1024;
const ATTEMPTS: Array<{ maxDim: number; quality: number }> = [
  { maxDim: 2048, quality: 85 },
  { maxDim: 1600, quality: 82 },
  { maxDim: 1280, quality: 80 },
  { maxDim: 1024, quality: 75 },
  { maxDim: 800, quality: 70 },
];

export async function compressServerImage(
  input: Buffer,
): Promise<ServerCompressed> {
  let last: { buf: Buffer; width: number; height: number } | null = null;
  let i = 0;
  for (const { maxDim, quality } of ATTEMPTS) {
    i += 1;
    const pipeline = sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: maxDim,
        height: maxDim,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    last = { buf: data, width: info.width, height: info.height };
    if (data.length <= TARGET_BYTES) break;
  }
  if (!last) throw new Error("Komprimering fejlede");
  return {
    buffer: last.buf,
    bytes: last.buf.length,
    width: last.width,
    height: last.height,
    mimeType: "image/jpeg",
    attempts: i,
  };
}
