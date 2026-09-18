import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { getBlobStream } from "@/lib/blob";
import { findCollectionOwner } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ type: string; id: string }>;

async function serve(
  blobUrl: string,
  mimeType: string,
  filename: string,
  inline: boolean,
) {
  const { stream, contentLength } = await getBlobStream(blobUrl);
  if (!stream) {
    return new Response("Blob not available", { status: 502 });
  }
  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`,
    "Cache-Control": "private, max-age=3600",
    // Browseren må aldrig gætte sig til en anden (farligere) type.
    "X-Content-Type-Options": "nosniff",
  };
  if (contentLength !== undefined) {
    headers["Content-Length"] = String(contentLength);
  }
  return new Response(stream, { headers });
}

export async function GET(req: Request, { params }: { params: Params }) {
  const { type, id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return new Response("Bad id", { status: 400 });
  }

  // Offentlig token-adgang — KUN opskriftsbilleder, og kun når tokenet
  // matcher opskriftens eget delelink eller ejerens samlings-link.
  // Alt andet kræver login som hidtil.
  if (type === "recipe") {
    const token = new URL(req.url).searchParams.get("token");
    if (token) {
      const rows = await db
        .select()
        .from(schema.recipes)
        .where(eq(schema.recipes.id, id))
        .limit(1);
      const row = rows[0];
      if (!row || !row.imagePathname) {
        return new Response("Not found", { status: 404 });
      }
      const viaRecipe = row.shareToken !== null && row.shareToken === token;
      const viaCollection =
        !viaRecipe && (await findCollectionOwner(token))?.id === row.userId;
      if (!viaRecipe && !viaCollection) {
        return new Response("Not found", { status: 404 });
      }
      return serve(
        row.imagePathname,
        row.imageMime ?? "image/jpeg",
        `recipe-${row.id}.jpg`,
        true,
      );
    }
  }

  const user = await requireUser();

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
    return serve(row.blobUrl, row.mimeType, `photo-${row.id}.jpg`, true);
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
    // KUN PDF vises inline. text/html inline ville være stored XSS på
    // appens eget origin (uploadede jobopslag er ikke betroet indhold) —
    // alt tekstligt hentes derfor som download.
    const inline = row.mimeType === "application/pdf";
    return serve(row.blobUrl, row.mimeType, row.filename, inline);
  } else if (type === "recipe") {
    const rows = await db
      .select()
      .from(schema.recipes)
      .where(
        and(eq(schema.recipes.id, id), eq(schema.recipes.userId, user.id)),
      )
      .limit(1);
    const row = rows[0];
    if (!row || !row.imagePathname) {
      return new Response("Not found", { status: 404 });
    }
    return serve(
      row.imagePathname,
      row.imageMime ?? "image/jpeg",
      `recipe-${row.id}.jpg`,
      true,
    );
  }

  return new Response("Bad type", { status: 400 });
}
