"use server";

import { requireUser } from "@/lib/session";
import {
  backupSchema,
  performImport,
  type ImportResult,
} from "./import-impl";

// JSON-import via server-action (legacy / små backups uden filer).
// Store ZIP-backups skal poste til /api/import for at omgå body-size-limit.
export async function importData(raw: unknown): Promise<ImportResult> {
  const user = await requireUser();

  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Filen er ikke en gyldig Log-backup (forkert format eller felter).",
    };
  }

  return performImport(user.id, parsed.data, []);
}
