import {
  SCOPE,
  TOKEN_TYPE,
  consumeAuthCode,
  findClientByClientId,
  issueAccessToken,
  verifyClientSecret,
  verifyPkce,
} from "@/lib/oauth";
import { rateLimit } from "@/lib/rate-limit";

// Dummy-hash (bcrypt cost 12, af en ikke-hemmelig streng): ukendte
// client_id'er koster samme bcrypt-arbejde som kendte, så de ikke kan
// enumereres via svartid.
const DUMMY_SECRET_HASH =
  "$2b$12$PUHU0Fa6in43LSZE/GOV6.hMNfnCYnZIn8JlrvGKxiket1V2N559y";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OAuthError =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope";

function errorResponse(
  error: OAuthError,
  description: string,
  status = 400,
): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

function parseBasicAuth(header: string | null): [string, string] | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return [
      decodeURIComponent(decoded.slice(0, idx)),
      decodeURIComponent(decoded.slice(idx + 1)),
    ];
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  const { isDemoMode } = await import("@/lib/demo");
  if (isDemoMode()) return new Response("Not found", { status: 404 });

  // bcrypt (cost 12) koster ~0,3s CPU per forsøg — uden grænse er
  // endpointet et DoS-håndtag på en lille hjemmeserver.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ukendt";
  const rl = rateLimit(`oauth-token:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "For mange forsøg — prøv igen om lidt",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSec),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let body: URLSearchParams;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      body = new URLSearchParams(await req.text());
    } else if (contentType.includes("application/json")) {
      const json = (await req.json()) as Record<string, string>;
      body = new URLSearchParams(json);
    } else {
      return errorResponse(
        "invalid_request",
        "Content-Type skal være application/x-www-form-urlencoded",
      );
    }
  } catch {
    return errorResponse("invalid_request", "Ugyldig request body");
  }

  const grantType = body.get("grant_type");
  if (grantType !== "authorization_code") {
    return errorResponse(
      "unsupported_grant_type",
      `grant_type='${grantType}' understøttes ikke`,
    );
  }

  const code = body.get("code");
  const redirectUri = body.get("redirect_uri");
  const codeVerifier = body.get("code_verifier");
  if (!code || !redirectUri) {
    return errorResponse(
      "invalid_request",
      "code og redirect_uri er påkrævet",
    );
  }

  let clientId = body.get("client_id");
  let clientSecret = body.get("client_secret");
  const basic = parseBasicAuth(req.headers.get("authorization"));
  if (basic) {
    [clientId, clientSecret] = basic;
  }
  if (!clientId || !clientSecret) {
    return errorResponse(
      "invalid_client",
      "client_id og client_secret er påkrævet",
      401,
    );
  }

  // Ens svar (tekst OG timing) for ukendt client og forkert secret —
  // ellers kan client_id'er enumereres.
  const client = await findClientByClientId(clientId);
  const secretOk = await verifyClientSecret(
    clientSecret,
    client?.clientSecretHash ?? DUMMY_SECRET_HASH,
  );
  if (!client || !secretOk) {
    return errorResponse(
      "invalid_client",
      "Ugyldig client_id eller client_secret",
      401,
    );
  }

  const authCode = await consumeAuthCode(code);
  if (!authCode) {
    return errorResponse(
      "invalid_grant",
      "Auth code er ugyldig, brugt eller udløbet",
    );
  }
  if (authCode.clientId !== client.id) {
    return errorResponse(
      "invalid_grant",
      "Auth code blev ikke udstedt til denne client",
    );
  }
  if (authCode.redirectUri !== redirectUri) {
    return errorResponse(
      "invalid_grant",
      "redirect_uri matcher ikke den oprindelige authorize-request",
    );
  }

  if (authCode.codeChallenge) {
    if (!codeVerifier) {
      return errorResponse(
        "invalid_grant",
        "code_verifier er påkrævet (PKCE)",
      );
    }
    const pkceOk = verifyPkce(
      codeVerifier,
      authCode.codeChallenge,
      authCode.codeChallengeMethod,
    );
    if (!pkceOk) {
      return errorResponse(
        "invalid_grant",
        "code_verifier matcher ikke code_challenge",
      );
    }
  }

  const { token, expiresIn } = await issueAccessToken({
    clientId: client.id,
    userId: authCode.userId,
    scope: authCode.scope,
  });

  return new Response(
    JSON.stringify({
      access_token: token,
      token_type: TOKEN_TYPE,
      expires_in: expiresIn,
      scope: authCode.scope ?? SCOPE,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
