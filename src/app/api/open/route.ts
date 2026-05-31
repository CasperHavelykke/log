import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const rawPath =
    body && typeof (body as { path?: unknown }).path === "string"
      ? ((body as { path: string }).path as string).trim()
      : "";

  if (!rawPath) {
    return NextResponse.json({ error: "Sti mangler" }, { status: 400 });
  }

  if (!isAbsolute(rawPath)) {
    return NextResponse.json(
      { error: "Stien skal være absolut (fx F:\\Job\\Ravnit\\CV.pdf)" },
      { status: 400 },
    );
  }

  if (!existsSync(rawPath)) {
    return NextResponse.json(
      { error: `Findes ikke: ${rawPath}` },
      { status: 404 },
    );
  }

  // cmd /c start "" "<path>"  er Windows' kanoniske måde at åbne en sti med
  // default-handler — filer åbnes i tilknyttet app, mapper i Stifinder.
  // De tomme "" er vinduestitlen som start.exe kræver som første argument.
  try {
    await execFileAsync("cmd.exe", ["/c", "start", "", rawPath], {
      windowsHide: true,
      timeout: 10_000,
    });
  } catch (e) {
    const err = e as { stderr?: string; message?: string; code?: number };
    const msg =
      (err.stderr && err.stderr.trim()) ||
      err.message ||
      `Kunne ikke åbne (exit ${err.code ?? "?"})`;
    console.error(`[api/open] fejlede for "${rawPath}": ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
