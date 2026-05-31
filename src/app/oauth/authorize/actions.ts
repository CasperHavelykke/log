"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  SCOPE,
  SUPPORTED_CHALLENGE_METHODS,
  findClientByClientId,
  issueAuthCode,
  redirectUriAllowed,
} from "@/lib/oauth";

const inputSchema = z.object({
  clientId: z.string().min(1),
  redirectUri: z.string().url(),
  state: z.string().optional(),
  scope: z.string().optional(),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.enum(SUPPORTED_CHALLENGE_METHODS).optional(),
  decision: z.enum(["allow", "deny"]),
});

export async function authorizeAction(formData: FormData) {
  const user = await requireUser();

  const parsed = inputSchema.safeParse({
    clientId: formData.get("client_id"),
    redirectUri: formData.get("redirect_uri"),
    state: formData.get("state") || undefined,
    scope: formData.get("scope") || undefined,
    codeChallenge: formData.get("code_challenge") || undefined,
    codeChallengeMethod: formData.get("code_challenge_method") || undefined,
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    throw new Error("Ugyldigt OAuth-input");
  }
  const data = parsed.data;

  const client = await findClientByClientId(data.clientId);
  if (!client) throw new Error("Ukendt client_id");
  if (!redirectUriAllowed(client, data.redirectUri)) {
    throw new Error("Redirect URI ikke tilladt for denne client");
  }

  const target = new URL(data.redirectUri);
  if (data.state) target.searchParams.set("state", data.state);

  if (data.decision === "deny") {
    target.searchParams.set("error", "access_denied");
    redirect(target.toString());
  }

  const code = await issueAuthCode({
    clientId: client.id,
    userId: user.id,
    redirectUri: data.redirectUri,
    scope: data.scope ?? SCOPE,
    codeChallenge: data.codeChallenge ?? null,
    codeChallengeMethod: data.codeChallengeMethod ?? null,
  });

  target.searchParams.set("code", code);
  redirect(target.toString());
}
