import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { getBlobStream } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ type: string; id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const user = await requireUser();
  const { type, id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return new Response("Bad id", { status: 400 });
  }

  let blobUrl: string;
  let mimeType: string;
  let filename: string;
  let inline = true;

  if (type === "photo") {
    const rows = await db
      .select()
      .from(schema.photos)
      .where(
        and(eq(schema.photos.id, id), eq(schema.photos.userId, user.id)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return new Response("Not found", { status: 404 });
    blobUrl = row.blobUrl;
    mimeType = row.mimeType;
    filename = `photo-${row.id}.jpg`;
  } else if (type === "document") {
    const rows = await db
      .select()
      .from(schema.documents)
      .where(
        and(eq(schema.documents.id, id), eq(schema.documents.userId, user.id)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return new Response("Not found", { status: 404 });
    blobUrl = row.blobUrl;
    mimeType = row.mimeType;
    filename = row.filename;
    inline = mimeType === "application/pdf" || mimeType.startsWith("text/");
  } else {
    return new Response("Bad type", { status: 400 });
  }

  const { stream, contentLength } = await getBlobStream(blobUrl);
  if (!stream) {
    return new Response("Blob not available", { status: 502 });
  }

  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`,
    "Cache-Control": "private, max-age=3600",
  };
  if (contentLength !== undefined) {
    headers["Content-Length"] = String(contentLength);
  }

  return new Response(stream, { headers });
}
