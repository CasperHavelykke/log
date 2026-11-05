import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";
import { DOCUMENT_PREFIX, MAX_DOCUMENT_BYTES, uploadBlob } from "../../lib/blob";
import { extractText } from "../../lib/text-extract";

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

  server.registerTool(
    "create_document",
    {
      title: "Opret dokument",
      description:
        "Opretter et tekstbaseret dokument (HTML, Markdown eller ren tekst) og gemmer det som fil. Brug den til at gemme et jobopslag eller et udkast til en ansøgning — sæt jobApplicationId for at hænge det på ansøgningen. Kan IKKE lave PDF eller Word; send aldrig base64. Returnerer dokumentets id.",
      inputSchema: {
        kind: z
          .enum(schema.DOCUMENT_KINDS)
          .describe("application, cv, job_posting, reference eller other."),
        title: z.string().min(1).max(200).describe("Titel som vises i listen."),
        filename: z
          .string()
          .min(1)
          .max(120)
          .describe("Filnavn med endelse, fx 'novo-opslag.html' eller 'ansoegning.md'."),
        mimeType: z
          .enum(["text/html", "text/markdown", "text/plain"])
          .describe("Skal passe til filendelsen."),
        content: z
          .string()
          .min(1)
          .describe("Filens fulde indhold som tekst. Ikke base64."),
        jobApplicationId: z
          .number()
          .int()
          .nullable()
          .default(null)
          .describe("Hæng dokumentet på en ansøgning (id fra list_job_applications)."),
      },
    },
    async ({ kind, title, filename, mimeType, content, jobApplicationId }) => {
      const user = await getActiveUser();
      const buf = Buffer.from(content, "utf-8");
      if (buf.length > MAX_DOCUMENT_BYTES) {
        return errorContent("For stor — maks 10 MB.");
      }

      if (jobApplicationId !== null) {
        const apps = await db
          .select({ id: schema.jobApplications.id })
          .from(schema.jobApplications)
          .where(
            and(
              eq(schema.jobApplications.id, jobApplicationId),
              eq(schema.jobApplications.userId, user.id),
            ),
          )
          .limit(1);
        if (!apps[0]) return errorContent("Ansøgningen findes ikke.");
      }

      const extracted = await extractText(buf, mimeType);

      const uploaded = await uploadBlob({
        data: buf,
        prefix: `${DOCUMENT_PREFIX}/${user.id}`,
        filename,
        contentType: mimeType,
      });

      const inserted = await db
        .insert(schema.documents)
        .values({
          userId: user.id,
          kind,
          title: title.trim(),
          filename,
          blobUrl: uploaded.url,
          blobPathname: uploaded.pathname,
          mimeType,
          sizeBytes: uploaded.size,
          extractedText: extracted,
          jobApplicationId,
        })
        .returning();

      return jsonContent(shapeListItem(inserted[0]));
    },
  );

  server.registerTool(
    "attach_document",
    {
      title: "Tilknyt dokument til ansøgning",
      description:
        "Hænger et eksisterende dokument på en jobansøgning, eller flytter det til en anden. Sæt jobApplicationId til null for at fjerne tilknytningen. Selve filen ændres ikke.",
      inputSchema: {
        documentId: z.number().int().describe("Dokumentets id (fra list_documents)."),
        jobApplicationId: z
          .number()
          .int()
          .nullable()
          .describe("Ansøgningens id, eller null for at fjerne tilknytningen."),
      },
    },
    async ({ documentId, jobApplicationId }) => {
      const user = await getActiveUser();
      const rows = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, documentId),
            eq(schema.documents.userId, user.id),
          ),
        )
        .limit(1);
      const doc = rows[0];
      if (!doc) return errorContent("Dokument findes ikke.");
      if (jobApplicationId !== null) {
        const apps = await db
          .select({ id: schema.jobApplications.id })
          .from(schema.jobApplications)
          .where(
            and(
              eq(schema.jobApplications.id, jobApplicationId),
              eq(schema.jobApplications.userId, user.id),
            ),
          )
          .limit(1);
        if (!apps[0]) return errorContent("Ansøgningen findes ikke.");
      }

      const updated = await db
        .update(schema.documents)
        .set({ jobApplicationId })
        .where(eq(schema.documents.id, documentId))
        .returning();

      return jsonContent(shapeListItem(updated[0]));
    },
  );

}