import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;
export const AUTH_CODE_TTL_SECONDS = 60 * 10;
export const TOKEN_TYPE = "Bearer";
export const SCOPE = "mcp";
export const SUPPORTED_RESPONSE_TYPES = ["code"] as const;
export const SUPPORTED_GRANT_TYPES = ["authorization_code"] as const;
// KUN S256: 'plain' giver ingen beskyttelse hvis challengen lækker, og
// MCP-specifikationen kræver S256. PKCE er obligatorisk (håndhævet i
// authorize-siden/-action og token-endpointet).
export const SUPPORTED_CHALLENGE_METHODS = ["S256"] as const;

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export async function hashClientSecret(secret: string): Promise<string> {
  return hashPassword(secret);
}

export async function verifyClientSecret(
  secret: string,
  hash: string,
): Promise<boolean> {
  return verifyPassword(secret, hash);
}

export function verifyPkce(
  codeVerifier: string,
  challenge: string,
  method: string | null,
): boolean {
  if (method === "S256") {
    const computed = sha256(codeVerifier);
    return constantTimeStringEquals(computed, challenge);
  }
  // 'plain' og manglende metode afvises — S256 er obligatorisk.
  return false;
}

function constantTimeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return timingSafeEqual(ba, bb);
}

export async function findClientByClientId(clientId: string) {
  const rows = await db
    .select()
    .from(schema.oauthClients)
    .where(eq(schema.oauthClients.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

export function parseRedirectUris(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === "string");
  } catch {
    return [];
  }
}

export function redirectUriAllowed(
  client: { redirectUris: string },
  uri: string,
): boolean {
  const allowed = parseRedirectUris(client.redirectUris);
  return allowed.includes(uri);
}

export async function validateAccessToken(token: string): Promise<{
  userId: number;
  clientId: number;
  scope: string | null;
} | null> {
  const hash = sha256(token);
  const rows = await db
    .select({
      userId: schema.oauthAccessTokens.userId,
      clientId: schema.oauthAccessTokens.clientId,
      scope: schema.oauthAccessTokens.scope,
      expiresAt: schema.oauthAccessTokens.expiresAt,
    })
    .from(schema.oauthAccessTokens)
    .where(
      and(
        eq(schema.oauthAccessTokens.tokenHash, hash),
        gt(schema.oauthAccessTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { userId: row.userId, clientId: row.clientId, scope: row.scope };
}

export async function issueAccessToken(params: {
  clientId: number;
  userId: number;
  scope: string | null;
}): Promise<{ token: string; expiresIn: number }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
  await db.insert(schema.oauthAccessTokens).values({
    tokenHash: sha256(token),
    clientId: params.clientId,
    userId: params.userId,
    scope: params.scope,
    expiresAt,
  });
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function issueAuthCode(params: {
  clientId: number;
  userId: number;
  redirectUri: string;
  scope: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
}): Promise<string> {
  const code = randomToken(32);
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000);
  await db.insert(schema.oauthAuthCodes).values({
    code,
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    expiresAt,
  });
  return code;
}

export async function consumeAuthCode(code: string) {
  // Atomisk engangsforbrug: DELETE..RETURNING i stedet for select-så-
  // delete, så to samtidige indløsninger aldrig begge kan få koden.
  const rows = await db
    .delete(schema.oauthAuthCodes)
    .where(eq(schema.oauthAuthCodes.code, code))
    .returning();
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

// Issuer-sandheden er APP_ORIGIN-env'en (fx https://loggen.app) — sat i
// produktion. X-Forwarded-* er klient-kontrollerbare headers og må ALDRIG
// definere issuer/endpoints i OAuth-metadata (host-header injection);
// fallback'en findes kun så lokal udvikling virker uden env.
export function baseUrl(req: Request): string {
  const configured = process.env.APP_ORIGIN;
  if (configured) return configured.replace(/\/+$/, "");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
