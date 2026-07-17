// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Storefront deep links for premium skills.
//
// On the cloud tier premium skills are bought in-app via Stripe. A self-hosted
// deployment (no Stripe) has no checkout, so it surfaces the todo.law storefront
// instead: each premium skill deep-links to its page and is bought there, then
// the signed .skill is installed locally. Base skills stay free either way.
export const MARKETPLACE_URL = (
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "https://todo.law/marketplace"
).replace(/\/+$/, "");

// A self-hosted build has Stripe disabled at build time.
export const STOREFRONT_BUY = process.env.NEXT_PUBLIC_STRIPE_ENABLED !== "true";

/**
 * Storefront link for a premium skill.
 *
 * The todo.law storefront has no per-skill pages — appending a slug 404s. It
 * does support `?app=` filtering, so deep-link to the catalogue pre-filtered
 * to Dealroom skills. The slug is accepted (and ignored) so call sites keep
 * passing it, ready for the day the storefront grows per-skill params.
 */
export function marketplaceSkillUrl(_slug?: string | null): string {
  const sep = MARKETPLACE_URL.includes("?") ? "&" : "?";
  return `${MARKETPLACE_URL}${sep}app=dealroom`;
}
