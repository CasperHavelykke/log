import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { CodeForm } from "./code-form";

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

  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
          <p className="mt-1 text-sm text-muted">Log ind for at fortsætte</p>
        </div>

        {step === "verify" && email ? (
          <CodeForm email={email} returnTo={returnTo} error={error} />
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                Login fejlede. Prøv igen eller kontakt support.
              </div>
            )}
            <LoginForm returnTo={returnTo} />
          </>
        )}
      </div>
    </main>
  );
}
