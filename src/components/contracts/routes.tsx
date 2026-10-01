// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Shared route code for `/contracts` (English) and `/es/contracts`
 * (Spanish). The pages are prerendered at build time: their content is the
 * repository's Markdown, and the only per-visitor part (the price line)
 * loads in the browser.
 */

import type { Metadata } from "next";
import { CONTRACT_PAGES, loadContractPage, type PageLocale } from "@/lib/contract-pages";
import { contractMetadata } from "@/lib/contract-pages-seo";
import { CONTRACT_COPY } from "./copy";

export function contractStaticParams() {
  return CONTRACT_PAGES.map((p) => ({ slug: p.slug }));
}

export function indexMetadata(locale: PageLocale): Metadata {
  const copy = CONTRACT_COPY[locale];
  return contractMetadata({ locale, title: copy.indexMetaTitle, description: copy.indexDescription });
}

export function guideMetadata(locale: PageLocale, slug: string): Metadata {
  const page = loadContractPage(slug, locale);
  if (!page) return {};
  return contractMetadata({ locale, slug, title: page.title, description: page.description });
}
