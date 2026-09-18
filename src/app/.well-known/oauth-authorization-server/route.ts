import {
  SCOPE,
  SUPPORTED_CHALLENGE_METHODS,
  SUPPORTED_GRANT_TYPES,
  SUPPORTED_RESPONSE_TYPES,
  baseUrl,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const base = baseUrl(req);
  const metadata = {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    response_types_supported: [...SUPPORTED_RESPONSE_TYPES],
    grant_types_supported: [...SUPPORTED_GRANT_TYPES],
    code_challenge_methods_supported: [...SUPPORTED_CHALLENGE_METHODS],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],
    scopes_supported: [SCOPE],
  };
  return Response.json(metadata, {
    headers: { "Cache-Control": "no-store" },
  });
}
