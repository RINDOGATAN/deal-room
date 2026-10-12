// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { Inter, Dancing_Script, Jost, Archivo_Black, Space_Mono } from "next/font/google";
import "./globals.css";
import { LegalNotice } from "@/components/legal-notice";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

// Page speed: only the two fonts every public page draws
// with (Jost for text, Archivo Black for headings) are preloaded. Inter is not
// used by the stylesheet, Dancing Script only on the signature page and Space
// Mono only in code samples; preloading them held back the first paint on
// phones. They still load, with `display: swap`, where a page uses them.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  preload: false,
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-signature",
  weight: ["400", "700"],
  preload: false,
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
  preload: false,
});

const siteUrl = `https://dealroom.${brand.domain}`;

// Hosted with pay per contract says so; the kit (payments off) keeps the
// neutral wording.
const tagline = features.stripeEnabled ? brand.taglinePerContract : brand.tagline;
const description = features.stripeEnabled ? brand.descriptionPerContract : brand.description;

export const metadata: Metadata = {
  title: `Dealroom: ${tagline}`,
  description,
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
    title: `Dealroom: ${tagline}`,
    description,
    url: siteUrl,
    siteName: "Dealroom",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Dealroom: ${tagline}`,
    description,
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

  return (
    // suppressHydrationWarning: the prerendered Spanish contract pages set
    // `lang` from their URL before hydration (ContractsShell).
    <html lang={locale} data-brand={brand.id} suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://t.sealmetrics.com" />
        <script async src="https://t.sealmetrics.com/t.js?id=todolaw" />
      </head>
      <body className={`${inter.variable} ${dancingScript.variable} ${jost.variable} ${archivoBlack.variable} ${spaceMono.variable} font-sans antialiased min-h-screen flex flex-col`}>
        {/* Nothing app-wide here (page speed): the message
            catalogue, the session, the tRPC client and the toaster come with
            the sections that use them (AppSection), not with every public page. */}
        <NextIntlClientProvider messages={{}}>
          {children}
          <LegalNotice />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
