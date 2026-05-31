import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { MCP_SERVER_INFO, registerAllTools } from "@/mcp/register";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Bearer realm="dagbog"' },
  });
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function authenticate(req: Request): boolean {
  const expected = process.env.MCP_HTTP_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return constantTimeEquals(header, `Bearer ${expected}`);
}

async function handle(req: Request): Promise<Response> {
  if (!authenticate(req)) return unauthorized();

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
