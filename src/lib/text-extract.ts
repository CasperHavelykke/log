import "server-only";

import mammoth from "mammoth";
import { convert as htmlToText } from "html-to-text";
import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";

export const EXTRACTABLE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/html",
  "text/markdown",
]);

export function canExtractText(mimeType: string): boolean {
  return EXTRACTABLE_MIME_TYPES.has(mimeType);
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (!canExtractText(mimeType)) return null;
  try {
    if (mimeType === "application/pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await unpdfExtract(pdf, { mergePages: true });
      return normalize(text);
    }
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return normalize(result.value);
    }
    if (mimeType === "text/html") {
      const text = htmlToText(buffer.toString("utf8"), {
        wordwrap: false,
        selectors: [
          { selector: "img", format: "skip" },
          { selector: "a", options: { ignoreHref: true } },
        ],
      });
      return normalize(text);
    }
    return normalize(buffer.toString("utf8"));
  } catch (err) {
    console.error("Text extraction failed:", err);
    return null;
  }
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
