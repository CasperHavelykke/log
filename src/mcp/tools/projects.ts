import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    "list_projects",
    {
      title: "List projekter",
      description: "Returnerer alle projekter. Som standard kun ikke-arkiverede.",
      inputSchema: {
        includeArchived: z.boolean().default(false),
      },
    },
    async ({ includeArchived }) => {
      const user = await getActiveUser();
      const rows = includeArchived
        ? await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.userId, user.id))
            .orderBy(asc(schema.projects.sortOrder), asc(schema.projects.name))
        : await db
            .select()
            .from(schema.projects)
            .where(
              and(
                eq(schema.projects.userId, user.id),
                eq(schema.projects.archived, false),
              ),
            )
            .orderBy(asc(schema.projects.sortOrder), asc(schema.projects.name));
      return jsonContent(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          archived: p.archived,
        })),
      );
    },
  );

  server.registerTool(
    "create_project",
    {
      title: "Opret projekt",
      description: "Opretter et nyt projekt og returnerer dets id.",
      inputSchema: {
        name: z.string().min(1).max(120),
        color: z.string().max(40).optional(),
      },
    },
    async ({ name, color }) => {
      const user = await getActiveUser();
      const inserted = await db
        .insert(schema.projects)
        .values({
          userId: user.id,
          name: name.trim(),
          color: color ?? null,
        })
        .returning();
      return jsonContent(inserted[0]);
    },
  );

  server.registerTool(
    "archive_project",
    {
      title: "Arkivér eller genåbn et projekt",
      description: "Sætter archived-flag på et projekt.",
      inputSchema: {
        id: z.number().int(),
        archived: z.boolean().default(true),
      },
    },
    async ({ id, archived }) => {
      const user = await getActiveUser();
      const result = await db
        .update(schema.projects)
        .set({ archived })
        .where(
          and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)),
        )
        .returning();
      if (!result[0]) return errorContent("Projekt findes ikke.");
      return jsonContent(result[0]);
    },
  );
}
