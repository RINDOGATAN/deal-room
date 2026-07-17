// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { brand } from "./brand";

/**
 * Stripe posture, readable on BOTH sides of the bundle split.
 *
 * `STRIPE_SECRET_KEY` only exists server-side — Next.js never inlines it into
 * the browser bundle, so any client component reading a flag derived from it
 * alone would always see "Stripe off" (and, before this OR existed, hosted
 * clients concluded every premium skill was free). The hosted deployment must
 * therefore set BOTH:
 *   - `STRIPE_SECRET_KEY`             (server truth, used by checkout/webhooks)
 *   - `NEXT_PUBLIC_STRIPE_ENABLED=true` (client-inlined signal for UI gating)
 * Self-hosted installs set neither, so both lanes agree Stripe is off and all
 * skills stay free. `src/lib/stripe.ts` still checks the secret key itself, so
 * a client-flag-only misconfiguration fails with a clear error, not a crash.
 */
const stripeConfigured =
  !!process.env.STRIPE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";

// All features that used to be gated to brand.id === "todo" are now
// always on — the second brand was retired on 2026-05-02. The flag
// shape is kept (rather than inlining `true`) so call-site reads
// like `features.marketplace` stay self-documenting.
export const features = {
  stripeEnabled: stripeConfigured,
  selfServiceUpgrade: stripeConfigured,
  inviteCodeAuth: brand.auth.mode === "invite-code",
  magicLinkAuth: brand.auth.mode === "magic-link",
  lawyerInvolvement: true,
  billing: stripeConfigured,
  // Disabled while every premium skill is free — a /marketplace listing of
  // priced skills contradicts the "everything's free right now" banner. Flip
  // back to `true` to restore the footer link + the page itself.
  marketplace: false,
  clientInvitations: true,
  agentApi: true,
  expertsApi: true,
  publicDocs: true,
  /** Cloud Intelligence API — data-driven biases, quality scoring, conflict detection */
  cloudIntelligence: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Document Certification — cryptographic hashing, RFC 3161 timestamps, audit certificates */
  certification: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Analytics Dashboard — negotiation benchmarks, counterparty intelligence */
  analytics: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Startup Quick Start — guided US Delaware C-Corp launch journey */
  startupJourney: true,
  /**
   * All premium skills available without an entitlement.
   *
   * True whenever EITHER holds:
   *   1. Stripe is not configured (neither STRIPE_SECRET_KEY nor
   *      NEXT_PUBLIC_STRIPE_ENABLED — see `stripeConfigured` above). With
   *      payments off there is no way to charge, so every skill is free for
   *      everyone. This is the self-hosted state; premium value there is the
   *      downloadable .skill install, not a server-side unlock.
   *   2. A promo env var is set: `FREE_TRIAL_ALL_SKILLS` (server-only) or
   *      `NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS` (server + client). Kept so a
   *      free window can still be opened while Stripe remains configured.
   *
   * The client-inlined `NEXT_PUBLIC_STRIPE_ENABLED` leg is what keeps hosted
   * browser bundles honest: the secret key is invisible to the client, so
   * without it every client evaluated this as "free". The public-prefixed
   * promo variant is required for the `<PromoBanner>` to render, for the same
   * inlining reason. Stripe checkout still functions whenever Stripe is
   * configured, so customers who subscribe during a promo keep their
   * entitlements.
   */
  allSkillsFree:
    !stripeConfigured ||
    process.env.NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS === "true" ||
    process.env.FREE_TRIAL_ALL_SKILLS === "true",
  /**
   * The "every premium skill is free right now" promo banner.
   *
   * Deliberately NOT derived from `allSkillsFree`: in the browser bundle
   * `STRIPE_SECRET_KEY` is always absent, so `allSkillsFree` is always true
   * client-side and would show cloud-promo language on self-hosted boxes
   * where nothing was ever for sale. The banner only makes sense during an
   * explicitly opened promo window, so it requires the explicit,
   * client-inlined opt-in — never a default.
   */
  promoBanner: process.env.NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS === "true",
  /**
   * The /skills page: offline .skill install + licence-file activation. This
   * is the self-host premium path (buy on the todo.law storefront, install
   * locally). On hosted, premium is a Stripe subscription — there is nothing
   * to upload — so the page and its nav link hide whenever Stripe is on.
   */
  skillInstaller: !stripeConfigured,
  /**
   * Embedded AI assists (capability visibility only). The real switch is the
   * install-level AI posture (AiSettings singleton, platform-admin set,
   * default off = zero AI calls). Set NEXT_PUBLIC_AI_ASSIST_ENABLED=false to
   * hide even the affordances.
   */
  aiAssist: process.env.NEXT_PUBLIC_AI_ASSIST_ENABLED !== "false",
} as const;
