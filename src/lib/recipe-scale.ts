// Portions-skalering af ingrediens-linjer. Parser det ledende tal på en
// linje og skalerer det; linjer uden ledende tal ("Salt og peber")
// returneres uændret. Delt mellem opskrifts-detaljesiden og de offentlige
// delesider.

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
};

export function parseLeadingQty(
  line: string,
): { qty: number; rest: string } | null {
  // Blandet tal: "1 1/2 dl"
  let m = line.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)(?=\s|$)/);
  if (m) {
    return {
      qty: Number(m[1]) + Number(m[2]) / Number(m[3]),
      rest: line.slice(m[0].length),
    };
  }
  // Brøk: "1/2 dl"
  m = line.match(/^(\d+)\s*\/\s*(\d+)(?=\s|$)/);
  if (m) {
    return { qty: Number(m[1]) / Number(m[2]), rest: line.slice(m[0].length) };
  }
  // Decimal/heltal: "400 g", "1,5 dl"
  m = line.match(/^(\d+(?:[.,]\d+)?)/);
  if (m) {
    return {
      qty: Number(m[1].replace(",", ".")),
      rest: line.slice(m[0].length),
    };
  }
  // Unicode-brøk: "½ løg"
  const first = line[0];
  if (first !== undefined && UNICODE_FRACTIONS[first] !== undefined) {
    return { qty: UNICODE_FRACTIONS[first], rest: line.slice(1) };
  }
  return null;
}

export function fmtQty(n: number): string {
  // Køkken-pragmatisk afrunding: store mængder som heltal, små med decimaler.
  let rounded: number;
  if (n >= 20) rounded = Math.round(n);
  else if (n >= 2) rounded = Math.round(n * 10) / 10;
  else rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(".", ",");
}

export function scaleLine(line: string, factor: number): string {
  if (factor === 1) return line;
  const parsed = parseLeadingQty(line);
  if (!parsed) return line;
  return `${fmtQty(parsed.qty * factor)}${parsed.rest}`;
}
