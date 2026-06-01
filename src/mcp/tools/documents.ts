import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

const PREVIEW_CHARS = 400;

function preview(text: string | null): string | null {
  if (!text) return null;
  if (text.length <= PREVIEW_CHARS) return text;
  return text.slice(0, PREVIEW_CHARS) + "…";
}

function shapeListItem(row: typeof schema.documents.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    blobUrl: row.blobUrl,
    jobApplicationId: row.jobApplicationId,
    hasExtractedText:
      !!row.extractedText && row.extractedText.length > 0,
    extractedChars: row.extractedText?.length ?? 0,
    textPreview: preview(row.extractedText),
    createdAt: row.createdAt,
  };
}

function shapeFull(row: typeof schema.documents.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    blobUrl: row.blobUrl,
    jobApplicationId: row.jobApplicationId,
    extractedText: row.extractedText,
    createdAt: row.createdAt,
  };
}

export function registerDocumentTools(server: McpServer) {
  server.registerTool(
    "list_documents",
    {
      title: "List dokumenter",
      description:
        "Returnerer alle uploaded dokumenter (CV'er, ansøgninger, job-opslag, referencer). Inkluderer en kort preview af ekstraheret tekst. Brug get_document for fuld tekst.",
      inputSchema: {
        kind: z
          .enum(schema.DOCUMENT_KINDS)
          .optional()
          .describe(
            "Filtrér på type: application, cv, job_posting, reference, other.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(50)
          .describe("Maks antal returneret."),
      },
    },
    async ({ kind, limit }) => {
      const user = await getActiveUser();
      const whereClause = kind
        ? and(
            eq(schema.documents.userId, user.id),
            eq(schema.documents.kind, kind),
          )
        : eq(schema.documents.userId, user.id);

      const rows = await db
        .select()
        .from(schema.documents)
        .where(whereClause)
        .orderBy(desc(schema.documents.createdAt))
        .limit(limit);

      return jsonContent({
        count: rows.length,
        documents: rows.map(shapeListItem),
      });
    },
  );

  server.registerTool(
    "search_documents",
    {
      title: "Søg i dokumenter",
      description:
        "Søger på tværs af titler, filnavne og ekstraheret tekstindhold. Returnerer matches med previews — brug get_document for fuld tekst af relevante hits.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe("Søgeterm (case-insensitive substring match)."),
        kind: z.enum(schema.DOCUMENT_KINDS).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ query, kind, limit }) => {
      const user = await getActiveUser();
      const term = `%${query.trim()}%`;
      const conditions = [
        eq(schema.documents.userId, user.id),
        or(
          like(schema.documents.title, term),
          like(schema.documents.filename, term),
          like(schema.documents.extractedText, term),
        ),
      ];
      if (kind) conditions.push(eq(schema.documents.kind, kind));

      const rows = await db
        .select()
        .from(schema.documents)
        .where(and(...conditions))
        .orderBy(desc(schema.documents.createdAt))
        .limit(limit);

      return jsonContent({
        query,
        count: rows.length,
        documents: rows.map(shapeListItem),
      });
    },
  );

  server.registerTool(
    "get_document",
    {
      title: "Hent fuldt dokument",
      description:
        "Returnerer fuld ekstraheret tekst for et bestemt dokument. Brug efter list_documents eller search_documents til at læse hele indholdet.",
      inputSchema: {
        id: z.number().int().describe("Dokumentets ID."),
      },
    },
    async ({ id }) => {
      const user = await getActiveUser();
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, id),
            eq(schema.documents.userId, user.id),
          ),
        )
        .limit(1);
      const doc = rows[0];
      if (!doc) return errorContent("Dokument findes ikke.");
      return jsonContent(shapeFull(doc));
    },
  );
}
