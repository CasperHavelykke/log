import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import {
  SUPPORTED_CHALLENGE_METHODS,
  findClientByClientId,
  redirectUriAllowed,
} from "@/lib/oauth";
import { authorizeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Autoriser adgang · Log" };

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const params = await searchParams;
  const clientIdParam = first(params.client_id);
  const redirectUri = first(params.redirect_uri);
  const responseType = first(params.response_type);
  const state = first(params.state);
  const scope = first(params.scope);
  const codeChallenge = first(params.code_challenge);
  const codeChallengeMethod = first(params.code_challenge_method);

  if (!clientIdParam || !redirectUri) {
    return (
      <ErrorPage
        title="Manglende parameter"
        detail="Forespørgslen mangler client_id eller redirect_uri."
      />
    );
  }
  if (responseType !== "code") {
    return (
      <ErrorPage
        title="Ikke understøttet response_type"
        detail={`response_type='${responseType}' understøttes ikke. Forventer 'code'.`}
      />
    );
  }
  if (
    codeChallengeMethod &&
    !(SUPPORTED_CHALLENGE_METHODS as readonly string[]).includes(
      codeChallengeMethod,
    )
  ) {
    return (
      <ErrorPage
        title="Ikke understøttet code_challenge_method"
        detail={`code_challenge_method='${codeChallengeMethod}' understøttes ikke. Forventer S256 eller plain.`}
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const currentUrl = `${proto}://${host}/oauth/authorize?${new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => {
        if (v === undefined) return [];
        return Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, v]];
      }),
    ).toString()}`;
    redirect(`/login?return_to=${encodeURIComponent(currentUrl)}`);
  }

  const client = await findClientByClientId(clientIdParam);
  if (!client) {
    return (
      <ErrorPage title="Ukendt client" detail={`client_id='${clientIdParam}'`} />
    );
  }
  if (!redirectUriAllowed(client, redirectUri)) {
    return (
      <ErrorPage
        title="Redirect URI ikke tilladt"
        detail={`Denne client har ikke '${redirectUri}' i sin tilladte liste.`}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <div className="rounded-md border border-border bg-card p-6">
        <h1 className="mb-2 font-serif text-[24px] text-ink">
          Giv adgang til Log?
        </h1>
        <p className="mb-4 text-[14px] text-mid">
          <span className="font-medium text-ink">{client.name}</span> beder om
          adgang til at læse og redigere din logbog via MCP.
        </p>

        <div className="mb-5 rounded-[3px] border border-border-light bg-bg p-3 text-[12px] text-light">
          Logget ind som <span className="text-ink">{user.name ?? user.username ?? user.email}</span>
        </div>

        <form action={authorizeAction} className="flex gap-2">
          <input type="hidden" name="client_id" value={clientIdParam} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          {state && <input type="hidden" name="state" value={state} />}
          {scope && <input type="hidden" name="scope" value={scope} />}
          {codeChallenge && (
            <input
              type="hidden"
              name="code_challenge"
              value={codeChallenge}
            />
          )}
          {codeChallengeMethod && (
            <input
              type="hidden"
              name="code_challenge_method"
              value={codeChallengeMethod}
            />
          )}
          <button
            type="submit"
            name="decision"
            value="allow"
            className="flex-1 cursor-pointer rounded-[3px] border border-accent bg-accent px-4 py-2.5 text-[14px] font-medium text-white hover:bg-accent-bright"
          >
            Tillad
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="cursor-pointer rounded-[3px] border border-border bg-transparent px-4 py-2.5 text-[14px] text-mid hover:border-danger hover:text-danger"
          >
            Afvis
          </button>
        </form>

        <p className="mt-4 text-[11px] text-dim">
          Tilladte handlinger: alle MCP-tools (læse + skrive i din database).
        </p>
      </div>
    </div>
  );
}

function ErrorPage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <div className="rounded-md border border-danger bg-card p-6">
        <h1 className="mb-2 font-serif text-[20px] text-danger">{title}</h1>
        <p className="text-[13px] text-mid">{detail}</p>
      </div>
    </div>
  );
}
