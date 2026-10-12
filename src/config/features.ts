// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { brand } from "./brand";
import { isHostedEnv } from "@/lib/hosted";
import { contractBillingConfigured } from "@/lib/contract-billing";

/**
 * The hosted deployment (dealroom.todo.law). Server code reads
 * `VERCEL_ENV`; the browser bundle reads `NEXT_PUBLIC_HOSTED_PILOT`, which
 * `next.config.ts` inlines at build time. The kit never matches.
 */
const hosted = isHostedEnv({
  NEXT_PUBLIC_HOSTED_PILOT: process.env.NEXT_PUBLIC_HOSTED_PILOT,
  VERCEL_ENV: process.env.VERCEL_ENV,
  AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
});

/**
 * Pay per contract (2026-09-29) is ready when the five variables are set:
 * the four Stripe price ids and `CONTRACT_BILLING_START`
 * (`src/lib/contract-billing.ts`). The browser bundle cannot see them, so
 * `next.config.ts` inlines the answer as `NEXT_PUBLIC_CONTRACT_BILLING`.
 */
const contractBillingReady =
  process.env.NEXT_PUBLIC_CONTRACT_BILLING === "true" ||
  contractBillingConfigured({
    STRIPE_PRICE_CONTRACT_USD: process.env.STRIPE_PRICE_CONTRACT_USD,
    STRIPE_PRICE_CONTRACT_EUR: process.env.STRIPE_PRICE_CONTRACT_EUR,
    STRIPE_PRICE_CREDITS_10_USD: process.env.STRIPE_PRICE_CREDITS_10_USD,
    STRIPE_PRICE_CREDITS_10_EUR: process.env.STRIPE_PRICE_CREDITS_10_EUR,
    CONTRACT_BILLING_START: process.env.CONTRACT_BILLING_START,
  });

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
 *
 * On the hosted deployment the Stripe variables alone are not enough: the
 * hosted build keeps Stripe off in the app until the four per-contract
 * price variables and `CONTRACT_BILLING_START` are set as well. That keeps a deploy of this code from switching billing on before
 * the prices and the start date exist.
 */
const stripeConfigured =
  (!hosted || contractBillingReady) &&
  (!!process.env.STRIPE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true");

/** The agent API (/api/v1/agent): on in every posture. */
const agentApi = true;

// All features that used to be gated to brand.id === "todo" are now
// always on — the second brand was retired on 2026-05-02. The flag
// shape is kept (rather than inlining `true`) so call-site reads
// like `features.marketplace` stay self-documenting.
export const features = {
  /**
   * The hosted deployment, whatever its billing state. False on the kit.
   */
  hosted,
  /**
   * Stripe on. With it, pay per contract applies: downloads and the start
   * of the signature need the deal to be paid (`deal_payments`).
   */
  stripeEnabled: stripeConfigured,
  selfServiceUpgrade: stripeConfigured,
  inviteCodeAuth: brand.auth.mode === "invite-code",
  magicLinkAuth: brand.auth.mode === "magic-link",
  lawyerInvolvement: true,
  billing: stripeConfigured,
  // Re-enabled 2026-08-05 (was off during the all-skills-free promo, when a
  // priced catalog contradicted the "everything's free" banner). Hosted shows
  // price + Stripe "Enable"; self-host shows storefront "Get it on todo.law"
  // links (the STOREFRONT_BUY split in src/lib/marketplace.ts).
  marketplace: true,
  clientInvitations: true,
  agentApi,
  /**
   * Settings, API keys: a signed-in person creates and revokes their own
   * agent API keys and buys credits. Needs the agent API and billing on
   * (agents pay per contract with prepaid credits), so it exists on hosted
   * with billing on and never on the kit, where keys stay with the
   * platform administrator.
   */
  selfServiceApiKeys: agentApi && stripeConfigured,
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
   * Startup coverage, first set: the agent tools find_template, explain_options,
   * list_obligations, get_deadlines and share_with_attorney, their REST
   * routes, and the "invite your own lawyer" action of the attorney review.
   * Off until `NEXT_PUBLIC_STARTUP_COVERAGE=true` is set at build time
   * (client-inlined, so the review page and the prerendered discovery files
   * agree). While off, the routes answer 404 and no surface lists the tools.
   */
  startupCoverage: process.env.NEXT_PUBLIC_STARTUP_COVERAGE === "true",
  /**
   * All premium skills available without a skill entitlement, in every
   * posture.
   *
   *   - Stripe off (self-host kit): there is no way to charge, so every
   *     skill is free; premium value there is the downloadable .skill
   *     install, not a server-side unlock. Unchanged.
   *   - Stripe on (hosted, pay per contract since 2026-09-29): every
   *     template serves without a skill entitlement because the price per
   *     contract covers it. The per-skill purchase and its yearly price are
   *     gone; what is paid is the contract (`deal_payments`).
   *
   * Kept as a flag (rather than deleting the entitlement branches) so the
   * dormant licensing code stays readable and reversible.
   */
  allSkillsFree: true,
  /**
   * The /skills page: offline .skill install + licence-file activation. This
   * is the self-host premium path (buy on the todo.law storefront, install
   * locally). The page and its nav link hide whenever Stripe is on, and on
   * the hosted service, where every skill is already available.
   */
  skillInstaller: !stripeConfigured && !hosted,
  /**
   * Local-credentials auth — the self-host posture signal.
   *
   * True on sovereign/suite installs (the published image bakes
   * `NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true`), false on hosted. Public-prefixed
   * so it inlines into the browser bundle and both lanes agree. Beyond auth
   * itself, this drives the solo-first experience: with no external mailer
   * there is no counterparty invite, so deal creation defaults to SOLO
   * wherever the skill supports it.
   */
  localAuth: process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED === "true",
  /**
   * Embedded AI assists (capability visibility only). The real switch is the
   * install-level AI posture (AiSettings singleton, platform-admin set,
   * default off = zero AI calls). Set NEXT_PUBLIC_AI_ASSIST_ENABLED=false to
   * hide even the affordances.
   */
  aiAssist: process.env.NEXT_PUBLIC_AI_ASSIST_ENABLED !== "false",
} as const;
