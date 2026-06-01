"use client";

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
  attempts: number;
};

export type CompressOptions = {
  targetBytes?: number;
  maxDimension?: number;
  quality?: number;
};

const DEFAULT_TARGET_BYTES = 500 * 1024;
const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_QUALITY = 0.85;

// Skridtvis fallback: prøv højere kvalitet/dimension først, ned-skalér hvis filen er for stor.
const ATTEMPTS: Array<{ maxDim: number; quality: number }> = [
  { maxDim: 2048, quality: 0.85 },
  { maxDim: 1600, quality: 0.82 },
  { maxDim: 1280, quality: 0.8 },
  { maxDim: 1024, quality: 0.75 },
  { maxDim: 800, quality: 0.7 },
];

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_BYTES;
  const customMax = options.maxDimension;
  const customQuality = options.quality;

  const bitmap = await readImage(file);

  // Hvis caller har givet specifikke værdier, brug bare dem ét forsøg
  if (customMax !== undefined || customQuality !== undefined) {
    const result = await encode(
      bitmap,
      customMax ?? DEFAULT_MAX_DIMENSION,
      customQuality ?? DEFAULT_QUALITY,
    );
    closeBitmap(bitmap);
    return { ...result, attempts: 1 };
  }

  // Ellers iterer gennem fallback-trin indtil targetBytes nås
  let last: { blob: Blob; width: number; height: number } | null = null;
  let attempts = 0;
  for (const { maxDim, quality } of ATTEMPTS) {
    attempts += 1;
    const result = await encode(bitmap, maxDim, quality);
    last = result;
    if (result.blob.size <= targetBytes) break;
  }
  closeBitmap(bitmap);
  if (!last) throw new Error("Komprimering fejlede");

  return {
    blob: last.blob,
    width: last.width,
    height: last.height,
    bytes: last.blob.size,
    mimeType: "image/jpeg",
    attempts,
  };
}

async function encode(
  bitmap: ImageBitmap,
  maxDim: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const targetW = Math.round(bitmap.width * scale);
  const targetH = Math.round(bitmap.height * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(targetW, targetH)
      : (() => {
          const c = document.createElement("canvas");
          c.width = targetW;
          c.height = targetH;
          return c;
        })();

  const ctx = (canvas as HTMLCanvasElement).getContext("2d");
  if (!ctx) throw new Error("Kunne ikke oprette canvas context");
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const mimeType = "image/jpeg";
  let blob: Blob;
  if (canvas instanceof OffscreenCanvas) {
    blob = await canvas.convertToBlob({ type: mimeType, quality });
  } else {
    blob = await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        mimeType,
        quality,
      );
    });
  }
  return { blob, width: targetW, height: targetH };
}

function closeBitmap(bitmap: ImageBitmap): void {
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
}

async function readImage(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Kunne ikke læse billede"));
      img.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
