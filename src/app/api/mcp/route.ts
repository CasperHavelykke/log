import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { MCP_SERVER_INFO, registerAllTools } from "@/mcp/register";
import { baseUrl, validateAccessToken } from "@/lib/oauth";

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
  const auth = await authenticate(req);
  if (!auth) return unauthorized(req, "invalid_token");

  const server = new McpServer(MCP_SERVER_INFO);
  registerAllTools(server);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
