import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, schema } from "../../db";
import { getActiveUser } from "../active-user";
import { jsonContent } from "../format";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shape(row: typeof schema.sleepEntries.$inferSelect) {
  return {
    date: row.date,
    source: row.source,
    score: row.score,
    qualityLabel: row.qualityLabel,
    durationMin: row.durationMin,
    durationHours:
      row.durationMin === null
        ? null
        : Math.round((row.durationMin / 60) * 100) / 100,
    deepMin: row.deepMin,
    lightMin: row.lightMin,
    remMin: row.remMin,
    awakeMin: row.awakeMin,
    avgStress: row.avgStress,
    avgHeartRate: row.avgHeartRate,
    restingHeartRate: row.restingHeartRate,
    bodyBatteryChange: row.bodyBatteryChange,
    avgSpO2: row.avgSpO2,
    lowestSpO2: row.lowestSpO2,
    avgBreathing:
      row.avgBreathingX10 === null ? null : row.avgBreathingX10 / 10,
    hrvMs: row.hrvMs,
    hrv7dStatus: row.hrv7dStatus,
    updatedAt: row.updatedAt,
  };
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

export function registerSleepTools(server: McpServer) {
  server.registerTool(
    "get_sleep_entry",
    {
      title: "Hent søvndata for en dato",
      description:
        "Returnerer Garmin-søvndata (score, varighed, stadier, HRV, SpO2, puls m.m.) for en bestemt dato. Standard: i dag.",
      inputSchema: {
        date: z
          .string()
          .regex(dateRegex)
          .optional()
          .describe("YYYY-MM-DD. Standard: i dag."),
      },
    },
    async ({ date }) => {
      const user = await getActiveUser();
      const target = date ?? todayIso();
      const rows = await db
        .select()
        .from(schema.sleepEntries)
        .where(
          and(
            eq(schema.sleepEntries.userId, user.id),
            eq(schema.sleepEntries.date, target),
          ),
        )
        .limit(1);
      return jsonContent({
        date: target,
        sleep: rows[0] ? shape(rows[0]) : null,
      });
    },
  );

  server.registerTool(
    "sleep_summary",
    {
      title: "Søvnoversigt for sidste N dage",
      description:
        "Aggregerer søvnscore, varighed, dyb/REM-andel, HRV, hvilepuls og stress over de sidste N dage. Bruges til at se mønstre over tid.",
      inputSchema: {
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(7)
          .describe("Antal dage tilbage (1-365). Standard: 7."),
      },
    },
    async ({ days }) => {
      const user = await getActiveUser();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

      const rows = await db
        .select()
        .from(schema.sleepEntries)
        .where(
          and(
            eq(schema.sleepEntries.userId, user.id),
            gte(schema.sleepEntries.date, startIso),
          ),
        )
        .orderBy(desc(schema.sleepEntries.date));

      const n = rows.length;
      const valid = (k: keyof typeof schema.sleepEntries.$inferSelect) => {
        const out: number[] = [];
        for (const r of rows) {
          const v = r[k];
          if (typeof v === "number") out.push(v);
        }
        return out;
      };

      return jsonContent({
        rangeDays: days,
        from: startIso,
        nights: n,
        avgScore: avg(valid("score")),
        avgDurationHours:
          avg(valid("durationMin")) === null
            ? null
            : Math.round((avg(valid("durationMin"))! / 60) * 100) / 100,
        avgDeepMin: avg(valid("deepMin")),
        avgLightMin: avg(valid("lightMin")),
        avgRemMin: avg(valid("remMin")),
        avgAwakeMin: avg(valid("awakeMin")),
        avgHrvMs: avg(valid("hrvMs")),
        avgRestingHeartRate: avg(valid("restingHeartRate")),
        avgStress: avg(valid("avgStress")),
        avgSpO2: avg(valid("avgSpO2")),
        recentNights: rows.slice(0, 7).map(shape),
      });
    },
  );
}
