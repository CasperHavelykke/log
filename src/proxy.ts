import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// Rate-limit på magic-link-callbacket. Login-koden er 6 cifre (900k
// muligheder), og Auth.js sletter kun tokens ved KORREKT gæt — uden en
// grænse her kan koden brute-forces af enhver der kender emailen.
// In-memory limiter er fint: én serverproces, og en genstart nulstiller
// blot vinduet.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function proxy(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.next();

  // Nøglet på EMAIL alene: grænsen skal beskytte kontoen mod gæt på
  // koden, og en angriber kan frit rotere IP'er — ip i nøglen ville
  // gøre grænsen omgåelig og dermed meningsløs.
  const verdict = rateLimit(
    `verify:${email.toLowerCase()}`,
    MAX_ATTEMPTS,
    WINDOW_MS,
  );
  if (!verdict.ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=RateLimited";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/callback/:path*"],
};
