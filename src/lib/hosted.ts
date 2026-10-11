// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which build is the hosted service (dealroom.todo.law), and whether its
 * billing is on. Pure functions of the environment, so the feature flags
 * (`src/config/features.ts`) and the tests read the same answer.
 *
 * The free, capped hosted pilot (90 days of editing, record ceilings, the
 * read-only state and its notices) was retired on 11 October 2026:
 * Dealroom is paid per contract. If hosted billing were ever switched off,
 * the hosted service would serve every skill with no caps, as the kit does.
 */

import { contractBillingConfigured } from "@/lib/contract-billing";

type Env = Record<string, string | undefined>;

/**
 * Whether this build runs as the hosted service. Uses the same signal as
 * the auth guards (`auth-provider-policy.ts`): Vercel production. The hosted
 * cookie domain counts too, but only when set explicitly: the implicit
 * `.todo.law` fallback in `auth.ts` applies to any production build without
 * `AUTH_COOKIE_DOMAIN`, and a kit must never be taken for the hosted service
 * by accident. `NEXT_PUBLIC_HOSTED_PILOT` (the variable keeps its old name)
 * is the build-time copy of this answer that `next.config.ts` inlines for
 * the browser bundle.
 */
export function isHostedEnv(env: Env): boolean {
  if (env.NEXT_PUBLIC_HOSTED_PILOT === "true") return true;
  if (env.VERCEL_ENV === "production") return true;
  const domain = env.AUTH_COOKIE_DOMAIN?.trim().toLowerCase();
  return !!domain && (domain === ".todo.law" || domain === "todo.law");
}

/**
 * Billing on: Stripe configured and, on the hosted deployment, the contract
 * prices and start date as well. The rule behind `features.stripeEnabled`.
 */
export function billingOnEnv(env: Env): boolean {
  const pricesReady = env.NEXT_PUBLIC_CONTRACT_BILLING === "true" || contractBillingConfigured(env);
  return (
    (!isHostedEnv(env) || pricesReady) &&
    (!!env.STRIPE_SECRET_KEY || env.NEXT_PUBLIC_STRIPE_ENABLED === "true")
  );
}
