// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { Inter, Dancing_Script, Jost, Archivo_Black, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { LegalNotice } from "@/components/legal-notice";
import { brand } from "@/config/brand";
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

export const metadata: Metadata = {
  title: `DEALROOM - ${brand.tagline}`,
  description: brand.description,
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
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

  return (
    <html lang={locale} data-brand={brand.id}>
      <head>
        <link rel="dns-prefetch" href="https://t.sealmetrics.com" />
        <script async src="https://t.sealmetrics.com/t.js?id=todolaw" />
      </head>
      <body className={`${inter.variable} ${dancingScript.variable} ${jost.variable} ${archivoBlack.variable} ${spaceMono.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
          {children}
          <Toaster />
          </Providers>
          <LegalNotice />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
