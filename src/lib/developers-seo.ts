// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Search-engine parts of the developer quick start: metadata with
 * canonical and hreflang alternates, and the JSON-LD (a HowTo for the three
 * steps, the list of contract guides, breadcrumbs).
 */

import type { Metadata } from "next";
import { PAGE_LOCALES, SITE_URL, contractPath, developersPath, type PageLocale } from "./contract-pages-paths";
import { OG_IMAGE_PATH } from "./contract-pages-seo";

const OG_LOCALE: Record<PageLocale, string> = { en: "en_US", es: "es_ES" };

export function developersMetadata(locale: PageLocale, title: string, description: string): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: developersPath(locale),
      languages: { en: developersPath("en"), es: developersPath("es"), "x-default": developersPath("en") },
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

export function developersJsonLd(opts: {
  locale: PageLocale;
  title: string;
  description: string;
  howToName: string;
  steps: { title: string; body: string }[];
  breadcrumb: string;
  contracts: { slug: string; name: string }[];
}): Record<string, unknown> {
  const url = `${SITE_URL}${developersPath(opts.locale)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name: opts.title,
        description: opts.description,
        inLanguage: opts.locale,
        isPartOf: { "@type": "WebSite", name: "Dealroom", url: SITE_URL },
      },
      {
        "@type": "HowTo",
        "@id": `${url}#howto`,
        name: opts.howToName,
        inLanguage: opts.locale,
        step: opts.steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.title,
          text: s.body,
          url: `${url}#step-${i + 1}`,
        })),
      },
      {
        "@type": "ItemList",
        "@id": `${url}#contracts`,
        inLanguage: opts.locale,
        numberOfItems: opts.contracts.length,
        itemListElement: opts.contracts.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          url: `${SITE_URL}${contractPath(opts.locale, c.slug)}`,
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
