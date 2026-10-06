// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Search-engine and agent-facing parts of the contract pages: page
 * metadata (title, description, canonical, hreflang alternates, Open
 * Graph) and the JSON-LD blocks. The agent example of each guide is in
 * `agent-discovery.ts`.
 */

import type { Metadata } from "next";
import {
  CONTRACT_PAGES,
  PAGE_LOCALES,
  SITE_URL,
  contractPath,
  type PageLocale,
} from "./contract-pages-paths";
import type { ContractPageContent } from "./contract-pages";

export const OG_IMAGE_PATH = "/og/contracts.png";
const OG_LOCALE: Record<PageLocale, string> = { en: "en_US", es: "es_ES" };

/** Canonical and hreflang alternates for a page (or the index). */
export function contractAlternates(locale: PageLocale, slug?: string): Metadata["alternates"] {
  return {
    canonical: contractPath(locale, slug),
    languages: {
      en: contractPath("en", slug),
      es: contractPath("es", slug),
      "x-default": contractPath("en", slug),
    },
  };
}

export function contractMetadata(opts: {
  locale: PageLocale;
  slug?: string;
  title: string;
  description: string;
}): Metadata {
  const { locale, slug, description } = opts;
  const title = `${opts.title} | Dealroom`;
  return {
    title: { absolute: title },
    description,
    alternates: contractAlternates(locale, slug),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${contractPath(locale, slug)}`,
      siteName: "Dealroom",
      locale: OG_LOCALE[locale],
      alternateLocale: PAGE_LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      type: slug ? "article" : "website",
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: "Dealroom" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE_PATH] },
  };
}

type JsonLd = Record<string, unknown>;

const PUBLISHER = {
  "@type": "Organization",
  name: "TODO.LAW",
  url: "https://todo.law",
};

function breadcrumbs(locale: PageLocale, items: { name: string; path: string }[]): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
    inLanguage: locale,
  };
}

/**
 * Article + FAQPage + BreadcrumbList for one contract page, plus any extra
 * nodes (the guide's agent block adds a WebAPI node).
 */
export function contractPageJsonLd(page: ContractPageContent, indexName: string, extra: JsonLd[] = []): JsonLd {
  const url = `${SITE_URL}${contractPath(page.locale, page.slug)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: page.heading || page.title,
        description: page.description,
        inLanguage: page.locale,
        url,
        mainEntityOfPage: url,
        image: `${SITE_URL}${OG_IMAGE_PATH}`,
        wordCount: page.wordCount,
        author: PUBLISHER,
        publisher: PUBLISHER,
        isPartOf: { "@type": "WebSite", name: "Dealroom", url: SITE_URL },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: page.locale,
        mainEntity: page.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      breadcrumbs(page.locale, [
        { name: "Dealroom", path: "/" },
        { name: indexName, path: contractPath(page.locale) },
        { name: page.heading || page.title, path: contractPath(page.locale, page.slug) },
      ]),
      ...extra,
    ],
  };
}

/** ItemList + BreadcrumbList for the index. */
export function contractIndexJsonLd(
  locale: PageLocale,
  indexName: string,
  pages: { slug: string; name: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: indexName,
        inLanguage: locale,
        numberOfItems: pages.length,
        itemListElement: pages.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.name,
          url: `${SITE_URL}${contractPath(locale, p.slug)}`,
        })),
      },
      breadcrumbs(locale, [
        { name: "Dealroom", path: "/" },
        { name: indexName, path: contractPath(locale) },
      ]),
    ],
  };
}

/** A JSON-LD object as the text of a script element (`<` escaped). */
export function jsonLdScript(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Every page path in both languages (for the sitemap and llms.txt checks). */
export function allContractPaths(): string[] {
  return PAGE_LOCALES.flatMap((l) => [contractPath(l), ...CONTRACT_PAGES.map((p) => contractPath(l, p.slug))]);
}
