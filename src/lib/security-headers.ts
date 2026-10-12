// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Security headers sent on every response (next.config.ts `headers()`).
 *
 * Same baseline as DPO Central: HSTS, no framing, no content-type sniffing,
 * a strict referrer policy, no camera, microphone or location, and a Content
 * Security Policy.
 *
 * The enforced CSP keeps 'unsafe-inline' for scripts because Next.js emits
 * inline bootstrap scripts without nonces on statically rendered pages. What
 * it enforces: scripts only from this origin and the two third parties the
 * pages load (the cookieless analytics script and Google's sign-in library),
 * no plugins, no <base> rewrite, forms only to this origin and the sign-in
 * and payment providers, and no framing by other sites. Network requests are
 * limited to https in the enforced policy; the exact list of hosts the pages
 * call is sent as Content-Security-Policy-Report-Only, so a missing host
 * shows in the browser console without breaking a page.
 */

const ANALYTICS = "https://t.sealmetrics.com";
const GOOGLE_ACCOUNTS = "https://accounts.google.com";
const GOOGLE_APIS = "https://www.googleapis.com";

export interface CspOptions {
  /** Next dev mode needs eval for react-refresh; production does not get it. */
  dev?: boolean;
}

function common(dev: boolean): string[] {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${ANALYTICS} ${GOOGLE_ACCOUNTS}`,
    `style-src 'self' 'unsafe-inline' ${GOOGLE_ACCOUNTS}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    `frame-src ${GOOGLE_ACCOUNTS}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${GOOGLE_ACCOUNTS} https://checkout.stripe.com https://billing.stripe.com`,
    "frame-ancestors 'none'",
  ];
}

/** The enforced policy. */
export function contentSecurityPolicy({ dev = false }: CspOptions = {}): string {
  return [...common(dev), `connect-src 'self' https:${dev ? " ws:" : ""}`].join("; ");
}

/** The report-only policy: the same, with the exact hosts the pages call. */
export function contentSecurityPolicyReportOnly({ dev = false }: CspOptions = {}): string {
  return [
    ...common(dev),
    `connect-src 'self' ${ANALYTICS} ${GOOGLE_APIS} ${GOOGLE_ACCOUNTS}${dev ? " ws:" : ""}`,
  ].join("; ");
}

export function securityHeaders(options: CspOptions = {}): { key: string; value: string }[] {
  return [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicyReportOnly(options) },
  ];
}
