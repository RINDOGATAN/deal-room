// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
import { describe, it, expect } from "vitest";
import {
  contentSecurityPolicy,
  contentSecurityPolicyReportOnly,
  securityHeaders,
} from "@/lib/security-headers";
import nextConfig from "../../../next.config";

function directive(policy: string, name: string): string {
  return policy.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
}

describe("security headers", () => {
  const headers = Object.fromEntries(securityHeaders().map((h) => [h.key, h.value]));

  it("sends the DPO Central baseline", () => {
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("enforces a CSP that limits script origins, plugins, base, forms and framing", () => {
    const csp = headers["Content-Security-Policy"];
    expect(directive(csp, "script-src")).toBe(
      "script-src 'self' 'unsafe-inline' https://t.sealmetrics.com https://accounts.google.com",
    );
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(directive(csp, "form-action")).toMatch(/^form-action 'self' /);
  });

  it("never allows eval in production, only in dev", () => {
    expect(contentSecurityPolicy()).not.toContain("unsafe-eval");
    expect(contentSecurityPolicyReportOnly()).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
  });

  it("report-only policy lists the exact hosts the pages call", () => {
    expect(directive(contentSecurityPolicyReportOnly(), "connect-src")).toBe(
      "connect-src 'self' https://t.sealmetrics.com https://www.googleapis.com https://accounts.google.com",
    );
  });

  it("next.config applies them to every path", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*");
    expect(all?.headers.map((h) => h.key)).toEqual(securityHeaders().map((h) => h.key));
  });
});
