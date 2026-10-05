// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { MetadataRoute } from "next";
import { CONTRACT_PAGES, SITE_URL, contractPath, developersPath } from "@/lib/contract-pages-paths";

/**
 * /sitemap.xml: the public pages (no signed-in routes such as
 * /marketplace), plus every contract guide in English and Spanish with
 * its language alternates, and the developer quick start in both. Replaces the former static public/sitemap.xml.
 */

export const dynamic = "force-static";

type Entry = MetadataRoute.Sitemap[number];

const STATIC_PAGES: [path: string, changeFrequency: Entry["changeFrequency"], priority: number][] = [
  ["", "weekly", 1.0],
  ["/pricing", "monthly", 0.8],
  ["/docs", "weekly", 0.8],
  ["/docs/how-it-works", "monthly", 0.7],
  ["/docs/compromise", "monthly", 0.7],
  ["/docs/skills", "monthly", 0.7],
  ["/docs/supervision", "monthly", 0.7],
  ["/docs/agent-api", "monthly", 0.6],
  ["/docs/agent-preparation", "monthly", 0.7],
  ["/docs/agent-preparation/policy", "monthly", 0.6],
  ["/docs/agent-preparation/playbook", "monthly", 0.6],
  ["/docs/agent-preparation/disputes", "monthly", 0.6],
  ["/docs/local-deployment", "monthly", 0.5],
  ["/licenses", "yearly", 0.3],
];

function contractEntries(slug: string | undefined, priority: number): Entry[] {
  const languages = {
    en: `${SITE_URL}${contractPath("en", slug)}`,
    es: `${SITE_URL}${contractPath("es", slug)}`,
  };
  return (["en", "es"] as const).map((locale) => ({
    url: languages[locale],
    changeFrequency: "monthly",
    priority,
    alternates: { languages },
  }));
}

/** The developer quick start, in both languages. */
function developerEntries(): Entry[] {
  const languages = { en: `${SITE_URL}${developersPath("en")}`, es: `${SITE_URL}${developersPath("es")}` };
  return (["en", "es"] as const).map((locale) => ({
    url: languages[locale],
    changeFrequency: "monthly",
    priority: 0.8,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.map(([path, changeFrequency, priority]) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency,
      priority,
    })),
    ...developerEntries(),
    ...contractEntries(undefined, 0.8),
    ...CONTRACT_PAGES.flatMap((p) => contractEntries(p.slug, 0.7)),
  ];
}
