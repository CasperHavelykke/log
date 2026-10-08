import type { NextConfig } from "next";

// Security headers på alle svar. Fuld CSP er bevidst udeladt endnu —
// temaets no-flash-script og Next's inline-chunks kræver nonce-arbejde,
// så den tages som sit eget skridt.
const securityHeaders = [
  // TLS terminieres i Caddy; HSTS herfra dækker loggen.app + demo.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ingen sider på Loggen har grund til at kunne indlejres i frames.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Kun dev: lader telefonen på hjemmenetværket hente dev-serverens
  // klient-scripts (ellers blokeres de som cross-origin, og klient-
  // komponenter som login-formularen renderer aldrig). Ingen effekt i prod.
  allowedDevOrigins: ["10.44.0.*", "localhost"],
  serverExternalPackages: ["better-sqlite3", "mammoth"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
