import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { errorContent, jsonContent } from "../format";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function registerCustomParameterTools(server: McpServer) {
  server.registerTool(
    "list_custom_parameters",
    {
      title: "List brugerens egne parametre",
      description:
        "Returnerer alle brugerdefinerede parametre brugeren har oprettet til Helbreds-loggen, inkl. type (boolean / scale_5 / scale_10 / bool_scale_5 / bool_scale_10 / number / text) og enhed (for number-typen).",
      inputSchema: {
        includeArchived: z.boolean().default(false),
      },
    },
    async ({ includeArchived }) => {
      const user = await getActiveUser();
      const rows = await db
        .select()
        .from(schema.customParameters)
        .where(
          includeArchived
            ? eq(schema.customParameters.userId, user.id)
            : and(
                eq(schema.customParameters.userId, user.id),
                eq(schema.customParameters.archived, false),
              ),
        )
        .orderBy(
          asc(schema.customParameters.sortOrder),
          asc(schema.customParameters.name),
        );
      return jsonContent({
        count: rows.length,
        parameters: rows.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          unit: p.unit,
          archived: p.archived,
        })),
      });
    },
  );

  server.registerTool(
    "get_custom_parameter_values",
    {
      title: "Hent værdier for alle egne parametre på en dato",
      description:
        "Returnerer alle loggede værdier for brugerens egne parametre på en bestemt dato. Inkluderer parameter-navn, type og værdi (afhængig af type).",
      inputSchema: {
        date: z.string().regex(dateRegex).describe("Dato YYYY-MM-DD"),
      },
    },
    async ({ date }) => {
      const user = await getActiveUser();
      const rows = await db
        .select({
          parameterId: schema.customParameterValues.parameterId,
          valueBool: schema.customParameterValues.valueBool,
          valueInt: schema.customParameterValues.valueInt,
          valueReal: schema.customParameterValues.valueReal,
          valueText: schema.customParameterValues.valueText,
          name: schema.customParameters.name,
          kind: schema.customParameters.kind,
          unit: schema.customParameters.unit,
        })
        .from(schema.customParameterValues)
        .innerJoin(
          schema.customParameters,
          eq(
            schema.customParameterValues.parameterId,
            schema.customParameters.id,
          ),
        )
        .where(
          and(
            eq(schema.customParameterValues.userId, user.id),
            eq(schema.customParameterValues.date, date),
          ),
        );
      return jsonContent({
        date,
        values: rows.map((r) => ({
          parameterId: r.parameterId,
          name: r.name,
          kind: r.kind,
          unit: r.unit,
          valueBool: r.valueBool,
          valueInt: r.valueInt,
          valueReal: r.valueReal,
          valueText: r.valueText,
        })),
      });
    },
  );

  server.registerTool(
    "set_custom_parameter_value",
    {
      title: "Sæt værdi for et brugerdefineret parameter",
      description:
        "Logger en værdi for et brugerdefineret parameter på en given dato. Send kun det relevante value-felt for parametertypen: boolean→valueBool; scale_5/scale_10→valueInt; bool_scale_X→valueBool + valueInt; number→valueReal; text→valueText. Send alle som null for at slette logget værdi.",
      inputSchema: {
        parameterId: z.number().int(),
        date: z.string().regex(dateRegex),
        valueBool: z.boolean().nullable().optional(),
        valueInt: z.number().int().nullable().optional(),
        valueReal: z.number().nullable().optional(),
        valueText: z.string().max(10_000).nullable().optional(),
      },
    },
    async ({ parameterId, date, valueBool, valueInt, valueReal, valueText }) => {
      const user = await getActiveUser();
      const pRows = await db
        .select()
        .from(schema.customParameters)
        .where(
          and(
            eq(schema.customParameters.id, parameterId),
            eq(schema.customParameters.userId, user.id),
          ),
        )
        .limit(1);
      if (!pRows[0]) return errorContent("Parameter findes ikke");

      const allNull =
        (valueBool === null || valueBool === undefined) &&
        (valueInt === null || valueInt === undefined) &&
        (valueReal === null || valueReal === undefined) &&
        (valueText === null ||
          valueText === undefined ||
          valueText === "");

      if (allNull) {
        await db
          .delete(schema.customParameterValues)
          .where(
            and(
              eq(schema.customParameterValues.userId, user.id),
              eq(schema.customParameterValues.parameterId, parameterId),
              eq(schema.customParameterValues.date, date),
            ),
          );
        return jsonContent({ action: "deleted", parameterId, date });
      }

      const existing = await db
        .select()
        .from(schema.customParameterValues)
        .where(
          and(
            eq(schema.customParameterValues.userId, user.id),
            eq(schema.customParameterValues.parameterId, parameterId),
            eq(schema.customParameterValues.date, date),
          ),
        )
        .limit(1);

      const now = new Date().toISOString();
      const fields = {
        valueBool: valueBool ?? null,
        valueInt: valueInt ?? null,
        valueReal: valueReal ?? null,
        valueText: valueText?.trim() || null,
        updatedAt: now,
      };

      if (existing[0]) {
        await db
          .update(schema.customParameterValues)
          .set(fields)
          .where(eq(schema.customParameterValues.id, existing[0].id));
        return jsonContent({ action: "updated", parameterId, date });
      } else {
        await db.insert(schema.customParameterValues).values({
          userId: user.id,
          parameterId,
          date,
          ...fields,
        });
        return jsonContent({ action: "created", parameterId, date });
      }
    },
  );
}
