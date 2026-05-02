import type { Metadata } from "next";
import { Inter, Dancing_Script, Jost, Archivo_Black, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-signature",
  weight: ["400", "700"],
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "700"],
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: "400",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

const siteUrl = `https://dealroom.${brand.domain}`;

// Browser tab + iOS app icons. The TODO build has a full PNG/SVG set
// (favicon.ico, icon.svg, icon-192, icon-512, apple-touch-icon); the
// NEL build ships a single PNG (/nel-icon.png) and uses it for every
// slot. Single-source PNGs work everywhere modern browsers render.
const brandIcons: Metadata["icons"] =
  brand.id === "northend"
    ? {
        icon: [{ url: brand.assets.icon, type: "image/png" }],
        apple: [{ url: brand.assets.icon, type: "image/png" }],
      }
    : {
        icon: [
          { url: "/favicon.ico", sizes: "48x48" },
          { url: "/icon.svg", type: "image/svg+xml" },
          { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
      };

export const metadata: Metadata = {
  title: `DEALROOM - ${brand.tagline}`,
  description: brand.description,
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  icons: brandIcons,
  manifest: "/site.webmanifest",
  openGraph: {
    title: `Dealroom — ${brand.tagline}`,
    description: brand.description,
    url: siteUrl,
    siteName: "Dealroom",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Dealroom — ${brand.tagline}`,
    description: brand.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  // The TODO deployment uses Sealmetrics (privacy-friendly analytics);
  // NEL clients should not be tracked into a TodoLaw property. If NEL
  // ever adds its own tracker we can branch the script src here.
  const isTodoBrand = brand.id === "todo";

  return (
    <html lang={locale} data-brand={brand.id}>
      <head>
        {isTodoBrand && (
          <>
            <link rel="dns-prefetch" href="https://t.sealmetrics.com" />
            <script async src="https://t.sealmetrics.com/t.js?id=todolaw" />
          </>
        )}
      </head>
      <body className={`${inter.variable} ${dancingScript.variable} ${jost.variable} ${archivoBlack.variable} ${spaceMono.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
          {children}
          <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
