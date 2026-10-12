// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The security page (/docs/security) states only what the code does. Each
 * test pins one statement to the code behind it, so changing either side
 * without the other fails here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SECOND_FACTOR_MAX_AGE_SECONDS } from "@/lib/portal-2fa";
import { securityHeaders } from "@/lib/security-headers";
import { OAUTH_TOKEN_FIELDS } from "@/lib/oauth-account";
import { SECURITY_CONTACT } from "@/config/security-contact";

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const en = JSON.parse(read("src/messages/en.json")).securityDocs;
const es = JSON.parse(read("src/messages/es.json")).securityDocs;

describe("security page claims", () => {
  it("has the same structure in English and Spanish", () => {
    const shape = (o: unknown): unknown =>
      Array.isArray(o) ? o.map(shape) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : typeof o;
    expect(shape(es)).toEqual(shape(en));
  });

  it("uses no long dashes and the informal Spanish form", () => {
    const all = JSON.stringify(en) + JSON.stringify(es);
    expect(all).not.toMatch(/[—–]/);
    expect(JSON.stringify(es)).not.toMatch(/\busted\b/i);
  });

  it("United States hosting: no function region is set (Vercel's default is in the US)", () => {
    expect(JSON.parse(read("vercel.json")).regions).toBeUndefined();
    expect(en.hosting.intro).toContain("United States");
  });

  it("no passwords: the schema has no password column", () => {
    expect(read("prisma/schema.prisma")).not.toMatch(/password/i);
  });

  it("no Google tokens kept: the adapter drops the provider tokens", () => {
    expect(OAUTH_TOKEN_FIELDS).toEqual(["access_token", "refresh_token", "id_token"]);
    expect(read("src/lib/auth.ts")).toContain("withoutOAuthTokens(account)");
  });

  it("session cookie: HTTP-only, SameSite=Lax", () => {
    const auth = read("src/lib/auth.ts");
    expect(auth).toMatch(/sessionToken:[\s\S]*?httpOnly: true,[\s\S]*?sameSite: "lax"/);
  });

  it("invitations: single use, 14 days, bound to the invited address", () => {
    const inv = read("src/server/routers/invitation.ts");
    expect(inv).toContain("addDays(new Date(), 14)");
    expect(inv).toContain("invitation.status !== InvitationStatus.PENDING");
    expect(inv).toContain("sameEmail(userEmail, invitation.email)");
  });

  it("second factor lasts four hours", () => {
    expect(SECOND_FACTOR_MAX_AGE_SECONDS).toBe(4 * 60 * 60);
  });

  it("AI is off by default", () => {
    expect(read("prisma/schema.prisma")).toMatch(/posture\s+AiPosture\s+@default\(off\)/);
  });

  it("browser protections are the headers actually sent", () => {
    const keys = securityHeaders().map((h) => h.key);
    for (const k of ["Strict-Transport-Security", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"]) {
      expect(keys).toContain(k);
    }
  });

  it("the contact address is the one in SECURITY.md", () => {
    expect(read("SECURITY.md")).toContain(SECURITY_CONTACT);
  });
});

describe("who can see a deal", () => {
  it("lawyers (supervisors) see only deals they are assigned to review", () => {
    const route = read("src/app/api/supervise/deals/[id]/document/route.ts");
    expect(route).toContain("supervisorAssignment.findUnique");
    expect(en.access.intro).toContain("a lawyer assigned to review the deal");
  });
});
