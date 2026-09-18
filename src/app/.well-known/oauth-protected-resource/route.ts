import { SCOPE, baseUrl } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const base = baseUrl(req);
  const metadata = {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
  };
  return Response.json(metadata, {
    headers: { "Cache-Control": "no-store" },
  });
}
