import type { Metadata, Viewport } from "next";
import { DM_Sans, EB_Garamond } from "next/font/google";
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
  title: "Log",
  description: "Personlig logbog for aktivitet, projekter og helbred",
  manifest: "/manifest.json",
  applicationName: "Log",
  appleWebApp: {
    capable: true,
    title: "Log",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${dmSans.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
