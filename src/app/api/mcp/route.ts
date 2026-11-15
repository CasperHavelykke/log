import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  MCP_SERVER_INFO,
  registerAllTools,
  registerCholesterolTools,
} from "@/mcp/register";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { baseUrl, validateAccessToken } from "@/lib/oauth";
import { runWithUser } from "@/mcp/active-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(req: Request, reason: string): Response {
  const resourceMetadata = `${baseUrl(req)}/.well-known/oauth-protected-resource`;
  const challenge = [
    'Bearer realm="dagbog"',
    `error="${reason}"`,
    `resource_metadata="${resourceMetadata}"`,
  ].join(", ");
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": challenge },
  });
}

async function authenticate(
  req: Request,
): Promise<{ userId: number } | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const session = await validateAccessToken(token);
  if (!session) return null;
  return { userId: session.userId };
}

async function handle(req: Request): Promise<Response> {
  const { isDemoMode } = await import("@/lib/demo");
  if (isDemoMode()) {
    return new Response("MCP er ikke tilgængelig i demoen", { status: 404 });
  }
  const auth = await authenticate(req);
  if (!auth) return unauthorized(req, "invalid_token");

  const prefRows = await db
    .select({ cholesterol: schema.users.cholesterolModeEnabled })
    .from(schema.users)
    .where(eq(schema.users.id, auth.userId))
    .limit(1);
  const cholesterolMode = prefRows[0]?.cholesterol ?? false;

  return runWithUser(auth.userId, async () => {
    const server = new McpServer(MCP_SERVER_INFO);
    if (cholesterolMode) registerCholesterolTools(server);
    else registerAllTools(server);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return transport.handleRequest(req);
  });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
