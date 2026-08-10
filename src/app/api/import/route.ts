import { NextRequest, NextResponse } from "next/server";
import { unzipSync, strFromU8 } from "fflate";
import { getCurrentUser } from "@/lib/session";
import {
  backupSchema,
  performImport,
  type ImportFile,
} from "@/app/(app)/settings/import-impl";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { isDemoMode } = await import("@/lib/demo");
    if (isDemoMode()) {
      return NextResponse.json(
        { ok: false, error: "Import er ikke tilgængelig i demoen" },
        { status: 403 },
      );
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Ikke logget ind" },
        { status: 401 },
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.error("[import] formData() fejlede:", err);
      return NextResponse.json(
        {
          ok: false,
          error: `Kunne ikke læse upload: ${err instanceof Error ? err.message : "ukendt"}.`,
        },
        { status: 400 },
      );
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Ingen fil modtaget." },
        { status: 400 },
      );
    }

    const filename = file.name.toLowerCase();
    const isZip =
      filename.endsWith(".zip") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed";

    let backupJson: unknown;
    const files: ImportFile[] = [];

    try {
      if (isZip) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const entries = unzipSync(buf);
        const jsonBytes = entries["backup.json"];
        if (!jsonBytes) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "ZIP'en mangler backup.json — er det en gyldig Log-backup?",
            },
            { status: 400 },
          );
        }
        backupJson = JSON.parse(strFromU8(jsonBytes));
        for (const [name, bytes] of Object.entries(entries)) {
          if (!name.startsWith("files/")) continue;
          if (name.endsWith("/")) continue;
          const inner = name.slice("files/".length);
          if (!/^(photos|documents|recipes)\//.test(inner)) continue;
          if (inner.includes("..")) continue;
          files.push({ path: inner, data: bytes });
        }
      } else {
        const text = await file.text();
        backupJson = JSON.parse(text);
      }
    } catch (err) {
      console.error("[import] kunne ikke parse fil:", err);
      return NextResponse.json(
        {
          ok: false,
          error: `Kunne ikke læse filen: ${err instanceof Error ? err.message : "ukendt fejl"}.`,
        },
        { status: 400 },
      );
    }

    const parsed = backupSchema.safeParse(backupJson);
    if (!parsed.success) {
      console.error("[import] schema-valideringsfejl:", parsed.error.issues);
      const firstIssue = parsed.error.issues[0];
      const fieldPath = firstIssue?.path.join(".") || "?";
      return NextResponse.json(
        {
          ok: false,
          error: `Backup-format afvist (felt: ${fieldPath} — ${firstIssue?.message ?? "ukendt"}).`,
        },
        { status: 400 },
      );
    }

    const result = await performImport(user.id, parsed.data, files);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("[import] uventet fejl:", err);
    return NextResponse.json(
      {
        ok: false,
        error: `Server-fejl under import: ${err instanceof Error ? err.message : "ukendt"}.`,
      },
      { status: 500 },
    );
  }
}
