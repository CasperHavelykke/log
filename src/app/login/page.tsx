import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { CodeForm } from "./code-form";
import { InstallPrompt } from "./install-prompt";
import { LoginGate } from "./login-gate";

export const metadata = { title: "Log ind | Log" };

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

function sanitizeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "/";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) return decoded;
    return "/";
  } catch {
    return "/";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const params = await searchParams;
  const returnToRaw = Array.isArray(params.return_to)
    ? params.return_to[0]
    : params.return_to;
  const returnTo = sanitizeReturnTo(returnToRaw);

  const step = params.step === "verify" ? "verify" : "email";
  const email = typeof params.email === "string" ? params.email : "";
  const error = typeof params.error === "string" ? params.error : undefined;
  const deleted = params.deleted === "1";

  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  return (
    <main
      className="flex items-center justify-center overflow-hidden px-4"
      style={{ height: "100vh" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-serif text-[34px] font-medium leading-none text-ink">
            Loggen
          </h1>
          <p className="mt-2 text-[13px] italic text-light">loggen.app</p>
        </div>

        {step === "verify" && email ? (
          <CodeForm email={email} returnTo={returnTo} error={error} />
        ) : (
          <>
            <InstallPrompt />
            {deleted && (
              <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                Din konto og alle data er slettet.
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                Login fejlede. Prøv igen eller kontakt support.
              </div>
            )}
            <LoginGate>
              <LoginForm returnTo={returnTo} />
            </LoginGate>
            <p className="mt-6 text-center text-[13px] text-light">
              Nysgerrig, men ikke klar til at oprette dig?{" "}
              <a
                href="https://demo.loggen.app"
                className="font-medium text-accent underline underline-offset-2 hover:text-accent-bright"
              >
                Prøv demoen →
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
