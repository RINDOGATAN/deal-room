// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which passwordless sign-in providers a build may register.
 *
 * Three providers sign a user in without a password or mailbox check:
 *   - `local`           email-only find-or-create (self-host posture)
 *   - `tester`          allowlisted fictitious users (journey testing)
 *   - `e2e-credentials` shared-secret sign-in for Playwright
 *
 * Each is switched on by an environment variable, so a single mistaken
 * variable on the hosted deployment would open an unauthenticated door.
 * This policy closes that door regardless of the variables:
 *
 *   - Hosted production (`VERCEL_ENV=production`): none of the three, ever.
 *     Vercel preview deployments are unaffected.
 *   - Any other production build (`NODE_ENV=production`, e.g. `next start`
 *     in CI or the self-host image): `tester` and `e2e-credentials` only
 *     with the explicit opt-in `ALLOW_TEST_AUTH_PROVIDERS=true`. `local`
 *     stays allowed, because it IS the self-host posture (the sovereign
 *     image runs with NODE_ENV=production and NEXT_PUBLIC_LOCAL_AUTH_ENABLED).
 *   - Development and test: whatever the variables say.
 */

export type PasswordlessProvider = "local" | "tester" | "e2e-credentials";

export interface AuthProviderPolicy {
  local: boolean;
  tester: boolean;
  e2e: boolean;
  /** Providers requested by env vars but refused by this policy. */
  refused: PasswordlessProvider[];
}

type Env = Record<string, string | undefined>;

export function resolveAuthProviderPolicy(env: Env): AuthProviderPolicy {
  const wantsLocal = env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED === "true";
  const wantsTester = env.TESTER_MODE_ENABLED === "true";
  const wantsE2e = !!env.E2E_CREDENTIALS_SECRET;

  const hostedProduction = env.VERCEL_ENV === "production";
  const productionBuild = env.NODE_ENV === "production";
  const testOptIn = env.ALLOW_TEST_AUTH_PROVIDERS === "true";

  const testProvidersAllowed =
    !hostedProduction && (!productionBuild || testOptIn);

  const local = wantsLocal && !hostedProduction;
  const tester = wantsTester && testProvidersAllowed;
  const e2e = wantsE2e && testProvidersAllowed;

  const refused: PasswordlessProvider[] = [];
  if (wantsLocal && !local) refused.push("local");
  if (wantsTester && !tester) refused.push("tester");
  if (wantsE2e && !e2e) refused.push("e2e-credentials");

  return { local, tester, e2e, refused };
}
