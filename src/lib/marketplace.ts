// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Storefront deep links for premium skills.
//
// On the cloud tier premium skills are bought in-app via Stripe. A self-hosted
// deployment (no Stripe) has no checkout, so it surfaces the todo.law storefront
// instead: each premium skill deep-links to its page and is bought there, then
// the signed .skill is installed locally. Base skills stay free either way.
export const MARKETPLACE_URL = (
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "https://todo.law/legalskills"
).replace(/\/+$/, "");

// A self-hosted build has Stripe disabled at build time.
export const STOREFRONT_BUY = process.env.NEXT_PUBLIC_STRIPE_ENABLED !== "true";

/** Deep link to a skill's storefront page, or the catalogue root if unknown. */
export function marketplaceSkillUrl(slug?: string | null): string {
  return slug ? `${MARKETPLACE_URL}/${slug}` : MARKETPLACE_URL;
}
