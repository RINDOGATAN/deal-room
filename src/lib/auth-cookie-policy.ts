// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One rule for the session cookie's `secure` flag and domain, read by the
 * sign-in (`auth.ts`) and by the sign-out (`/api/auth/cross-logout`). A
 * browser only removes a cookie when the removal carries the same domain as
 * the cookie, so the two must never disagree: when they did, a production
 * build served over plain http without `AUTH_COOKIE_DOMAIN` kept its session
 * after "Sign Out".
 *
 * - `secure`: a production build served over https (`NEXTAUTH_URL`).
 * - `domain`: `AUTH_COOKIE_DOMAIN` when set ("" means host-only, the
 *   self-host setting); otherwise the brand's cross-app domain on a secure
 *   production build, and host-only everywhere else.
 */

type Env = Record<string, string | undefined>;

export interface AuthCookiePolicy {
  secure: boolean;
  domain: string | undefined;
}

export function resolveAuthCookiePolicy(env: Env, brandCookieDomain: string): AuthCookiePolicy {
  const secure =
    env.NODE_ENV === "production" && (env.NEXTAUTH_URL?.startsWith("https://") ?? true);
  const domain =
    env.AUTH_COOKIE_DOMAIN !== undefined
      ? env.AUTH_COOKIE_DOMAIN || undefined
      : secure
        ? brandCookieDomain
        : undefined;
  return { secure, domain };
}
