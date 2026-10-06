// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Search-engine and agent-facing parts of the developer quick start:
 * metadata (canonical, hreflang, the Markdown twin as an alternate) and the
 * JSON-LD (WebPage, HowTo for the three steps, ItemList of the contract
 * types, WebAPI, BreadcrumbList), all from the page's own data.
 */

import type { Metadata } from "next";
import { PAGE_LOCALES, SITE_URL, developersPath, type PageLocale } from "./contract-pages-paths";
import { OG_IMAGE_PATH } from "./contract-pages-seo";
import type { DevelopersDoc } from "./developers-doc";

const OG_LOCALE: Record<PageLocale, string> = { en: "en_US", es: "es_ES" };

export function developersMetadata(locale: PageLocale, title: string, description: string): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: developersPath(locale),
      languages: { en: developersPath("en"), es: developersPath("es"), "x-default": developersPath("en") },
      // <link rel="alternate" type="text/markdown" href="/developers.md">
      types: { "text/markdown": `${developersPath(locale)}.md` },
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${developersPath(locale)}`,
      siteName: "Dealroom",
      locale: OG_LOCALE[locale],
      alternateLocale: PAGE_LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      type: "website",
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: "Dealroom" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE_PATH] },
  };
}

export function developersJsonLd(
  doc: DevelopersDoc,
  opts: { description: string; howToName: string; apiName: string; apiDescription: string; breadcrumb: string },
): Record<string, unknown> {
  const url = doc.url;
  const rows = doc.types.groups.flatMap((g) => g.rows);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name: doc.title,
        description: opts.description,
        inLanguage: doc.locale,
        isPartOf: { "@type": "WebSite", name: "Dealroom", url: SITE_URL },
        about: { "@id": `${url}#api` },
        encoding: { "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: doc.markdownUrl },
      },
      {
        "@type": "HowTo",
        "@id": `${url}#steps`,
        name: opts.howToName,
        inLanguage: doc.locale,
        step: doc.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.body })),
      },
      {
        "@type": "WebAPI",
        "@id": `${url}#api`,
        name: opts.apiName,
        description: opts.apiDescription,
        url: `${SITE_URL}/api/v1/agent`,
        documentation: `${SITE_URL}/docs/agent-api`,
        provider: { "@type": "Organization", name: "TODO.LAW", url: "https://todo.law" },
        potentialAction: {
          "@type": "CreateAction",
          name: doc.headings["one-call"],
          target: { "@type": "EntryPoint", httpMethod: "POST", urlTemplate: `${SITE_URL}/api/v1/agent/contracts`, contentType: "application/json" },
        },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#contract-types`,
        name: doc.headings["contract-types"],
        inLanguage: doc.locale,
        numberOfItems: rows.length,
        itemListElement: rows.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.name,
          identifier: r.code,
          ...(r.href ? { url: `${SITE_URL}${r.href}` } : {}),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Dealroom", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: opts.breadcrumb, item: url },
        ],
      },
    ],
  };
}
