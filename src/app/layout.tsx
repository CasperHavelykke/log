import type { Metadata, Viewport } from "next";
import { DM_Sans, EB_Garamond } from "next/font/google";
import { getThemePreference, resolveDataTheme } from "@/lib/theme";
import { ThemeColorSync } from "@/components/theme-color-sync";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-serif",
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loggen",
  description: "Personlig logbog for aktivitet, projekter og helbred",
  manifest: "/manifest.json",
  applicationName: "Loggen",
  appleWebApp: {
    capable: true,
    title: "Loggen",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
  ],
  viewportFit: "cover",
};

// Inline-script der sætter data-theme på <html> FØR body render, baseret
// på system-præference. Server-side sætter vi kun attributten hvis brugeren
// har valgt "light"/"dark" eksplicit; "auto" (default) lader denne snippet
// følge systemet, hvilket undgår blink ved første load.
const NO_FLASH_SCRIPT = `
(function(){try{
  var el = document.documentElement;
  if (el.getAttribute('data-theme')) return;
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  if (prefersLight) el.setAttribute('data-theme', 'light');
}catch(e){}})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themePref = await getThemePreference();
  const dataTheme = resolveDataTheme(themePref);

  return (
    <html
      lang="da"
      data-theme={dataTheme ?? undefined}
      className={`${dmSans.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <head>
        {dataTheme === null && (
          <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        )}
      </head>
      <body className="min-h-full">
        <ThemeColorSync />
        {children}
      </body>
    </html>
  );
}
