// Læser optagelsesdatoen ud af en JPEGs EXIF-blok — FØR komprimeringen
// (canvas → JPEG) stripper den. Kun det nødvendige: find APP1/Exif,
// parse TIFF-headeren, slå DateTimeOriginal op (fallback: DateTime).
// Returnerer "YYYY-MM-DD" eller null (PNG/HEIC/ukendt → null, så
// kalderen falder tilbage til i dag).

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const HEADER_BYTES = 256 * 1024; // EXIF ligger altid i starten af filen

type Entry = { type: number; count: number; valueOffset: number };

export async function readExifDate(file: File): Promise<string | null> {
  if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
  try {
    const buf = await file.slice(0, HEADER_BYTES).arrayBuffer();
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off);
      if ((marker & 0xff00) !== 0xff00) return null;
      const len = v.getUint16(off + 2);
      if (marker === 0xffe1 && off + 10 <= v.byteLength) {
        // "Exif" + \0\0 — TIFF-headeren starter 6 bytes inde i segmentet.
        if (v.getUint32(off + 4) === 0x45786966) {
          return parseTiff(v, off + 10);
        }
      }
      if (marker === 0xffda) break; // SOS: billeddata — ingen EXIF herefter
      off += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

function parseTiff(v: DataView, start: number): string | null {
  if (start + 8 > v.byteLength) return null;
  const order = v.getUint16(start);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const le = order === 0x4949;
  const u16 = (o: number) => (o + 2 <= v.byteLength ? v.getUint16(o, le) : 0);
  const u32 = (o: number) => (o + 4 <= v.byteLength ? v.getUint32(o, le) : 0);
  if (u16(start + 2) !== 0x2a) return null;

  function readIfd(ifd: number): Map<number, Entry> {
    const out = new Map<number, Entry>();
    if (ifd <= 0 || ifd + 2 > v.byteLength) return out;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > v.byteLength) break;
      out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOffset: e + 8 });
    }
    return out;
  }

  // ASCII-felter over 4 bytes ligger ude i filen (offset fra TIFF-start).
  function ascii(entry: Entry | undefined): string | null {
    if (!entry || entry.type !== 2 || entry.count === 0) return null;
    const at = entry.count > 4 ? start + u32(entry.valueOffset) : entry.valueOffset;
    if (at < 0 || at + entry.count > v.byteLength) return null;
    let s = "";
    for (let i = 0; i < entry.count; i++) {
      const c = v.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  const ifd0 = readIfd(start + u32(start + 4));
  let date: string | null = null;
  const exifPtr = ifd0.get(TAG_EXIF_IFD);
  if (exifPtr) {
    const exif = readIfd(start + u32(exifPtr.valueOffset));
    date = ascii(exif.get(TAG_DATETIME_ORIGINAL)) ?? ascii(exif.get(TAG_DATETIME_DIGITIZED));
  }
  if (!date) date = ascii(ifd0.get(TAG_DATETIME));
  // EXIF-format: "YYYY:MM:DD HH:MM:SS"
  const m = date ? /^(\d{4}):(\d{2}):(\d{2})/.exec(date) : null;
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
