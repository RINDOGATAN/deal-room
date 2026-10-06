// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Search-engine and agent-facing parts of the contract pages: page
 * metadata (title, description, canonical, hreflang alternates, Open
 * Graph), the JSON-LD blocks and the short agent API example.
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
import { SKILL_JURISDICTION_TO_GOVERNING_LAW } from "./jurisdictions";

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

/** Article + FAQPage + BreadcrumbList for one contract page. */
export function contractPageJsonLd(page: ContractPageContent, indexName: string): JsonLd {
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

// ---------------------------------------------------------------------------
// The agent example

const LAW_PREFERENCE: Record<PageLocale, string[]> = {
  en: ["ENGLAND_WALES", "CALIFORNIA", "SPAIN"],
  es: ["SPAIN", "ENGLAND_WALES", "CALIFORNIA"],
};

/**
 * The governing law the example uses: one the template itself lists that
 * is also a deal governing law (Spain first on Spanish pages), else null
 * (the agent intake cannot create that type; the example then only reads
 * the template).
 */
export function exampleGoverningLaw(jurisdictions: string[], locale: PageLocale): string | null {
  const usable = jurisdictions.filter((j) => SKILL_JURISDICTION_TO_GOVERNING_LAW[j] === j);
  return LAW_PREFERENCE[locale].find((l) => usable.includes(l)) ?? usable[0] ?? null;
}

export function agentExample(opts: {
  contractType: string;
  jurisdictions: string[];
  languages: string[];
  locale: PageLocale;
  dealName: string;
}): string {
  const base = `${SITE_URL}/api/v1/agent`;
  const read = [
    opts.locale === "es"
      ? "# 1. Leer las cláusulas, las opciones y los datos que pide"
      : "# 1. Read the clauses, options and the facts it needs",
    `curl ${base}/templates/${opts.contractType} \\`,
    `  -H "Authorization: Bearer drk_YOUR_KEY"`,
  ];
  // The governing law: one the page prefers, or none to send when the type
  // offers exactly one (Delaware runs under California).
  const law = exampleGoverningLaw(opts.jurisdictions, opts.locale);
  const mapped = new Set(
    opts.jurisdictions.map((j) => SKILL_JURISDICTION_TO_GOVERNING_LAW[j]).filter(Boolean),
  );
  if (!law && mapped.size !== 1) return read.join("\n");

  const es = opts.locale === "es";
  const language = opts.languages.includes(opts.locale) ? opts.locale : (opts.languages[0] ?? "en");
  const body = {
    contractType: opts.contractType,
    ...(law ? { governingLaw: law } : {}),
    language,
    title: opts.dealName,
    party: { legalName: es ? "Tu empresa" : "Your company" },
    counterparty: { legalName: es ? "La otra empresa" : "The other company" },
  };
  return [
    ...read,
    "",
    es
      ? "# 2. Crear el contrato en una sola llamada (gasta un crédito; las cláusulas que no indiques toman la opción estándar)"
      : "# 2. Make the contract in one call (spends one credit; clauses you leave out take the standard option)",
    `curl -X POST ${base}/contracts \\`,
    `  -H "Authorization: Bearer drk_YOUR_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: $(uuidgen)" \\`,
    `  -d '${JSON.stringify(body, null, 2).replace(/\n/g, "\n  ")}'`,
  ].join("\n");
}

/** Every page path in both languages (for the sitemap and llms.txt checks). */
export function allContractPaths(): string[] {
  return PAGE_LOCALES.flatMap((l) => [contractPath(l), ...CONTRACT_PAGES.map((p) => contractPath(l, p.slug))]);
}
