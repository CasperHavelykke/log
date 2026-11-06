import { requireUser } from "@/lib/session";
import { getBlobStream } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Brugerens eget profilbillede, til forhåndsvisning under Indstillinger.
export async function GET() {
  const user = await requireUser();
  if (!user.profileImagePathname) {
    return new Response("Intet billede", { status: 404 });
  }

  const { stream, contentLength } = await getBlobStream(
    user.profileImagePathname,
  );
  if (!stream) return new Response("Filen mangler", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (contentLength !== undefined) {
    headers["Content-Length"] = String(contentLength);
  }
  return new Response(stream, { headers });
}