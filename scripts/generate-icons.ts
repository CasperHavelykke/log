/**
 * Genererer PWA-ikon-PNGs fra public/icon.svg.
 * Kør efter ændringer i SVG'en: `tsx scripts/generate-icons.ts`
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const svgPath = resolve(process.cwd(), "public", "icon.svg");
const svg = readFileSync(svgPath);

const outputs = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
] as const;

async function main() {
  for (const { name, size } of outputs) {
    const outPath = resolve(process.cwd(), "public", name);
    await sharp(svg, { density: 320 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`  ✓ ${name.padEnd(24)} (${size}×${size})`);
  }
  console.log("\nFærdig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
