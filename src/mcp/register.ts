import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDayEntryTools } from "./tools/day-entries";
import { registerWeekGoalTools } from "./tools/week-goals";
import { registerProjectTools } from "./tools/projects";
import { registerTimeEntryTools } from "./tools/time-entries";
import { registerJobApplicationTools } from "./tools/job-applications";
import { registerSleepTools } from "./tools/sleep";
import { registerSupplementTools } from "./tools/supplements";
import { registerFastTools } from "./tools/fasts";
import { registerDocumentTools } from "./tools/documents";
import { registerPhotoTools } from "./tools/photos";
import { registerTrackerTools } from "./tools/trackers";
import { registerCustomParameterTools } from "./tools/custom-parameters";
import { registerRecipeTools } from "./tools/recipes";
import { registerWorkoutTools } from "./tools/workouts";
import { registerPlanTools } from "./tools/plan";

export const MCP_SERVER_INFO = {
  name: "dagbog",
  version: "0.11.0",
} as const;

export function registerAllTools(server: McpServer): void {
  registerDayEntryTools(server);
  registerWeekGoalTools(server);
  registerProjectTools(server);
  registerTimeEntryTools(server);
  registerJobApplicationTools(server);
  registerSleepTools(server);
  registerSupplementTools(server);
  registerFastTools(server);
  registerDocumentTools(server);
  registerPhotoTools(server);
  registerTrackerTools(server);
  registerCustomParameterTools(server);
  registerRecipeTools(server);
  registerWorkoutTools(server);
  registerPlanTools(server);
}
