// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAuthCookiePolicy } from "../auth-cookie-policy";

const BRAND = ".todo.law";

describe("resolveAuthCookiePolicy", () => {
  it("hosted: secure, shared across the brand domain", () => {
    expect(
      resolveAuthCookiePolicy(
        { NODE_ENV: "production", NEXTAUTH_URL: "https://dealroom.todo.law" },
        BRAND,
      ),
    ).toEqual({ secure: true, domain: BRAND });
  });

  it("production build over plain http: not secure and host-only", () => {
    // The case where sign-out used to clear `.todo.law` and miss the cookie.
    expect(
      resolveAuthCookiePolicy({ NODE_ENV: "production", NEXTAUTH_URL: "http://127.0.0.1:3014" }, BRAND),
    ).toEqual({ secure: false, domain: undefined });
  });

  it("self-host: an empty AUTH_COOKIE_DOMAIN means host-only", () => {
    expect(
      resolveAuthCookiePolicy(
        { NODE_ENV: "production", NEXTAUTH_URL: "https://dealroom.firm.example", AUTH_COOKIE_DOMAIN: "" },
        BRAND,
      ),
    ).toEqual({ secure: true, domain: undefined });
  });

  it("development: not secure, host-only", () => {
    expect(resolveAuthCookiePolicy({ NODE_ENV: "development" }, BRAND)).toEqual({
      secure: false,
      domain: undefined,
    });
  });

  it("sign-in and sign-out both read this policy", () => {
    const root = join(__dirname, "..", "..");
    const auth = readFileSync(join(root, "lib", "auth.ts"), "utf8");
    const logout = readFileSync(join(root, "app", "api", "auth", "cross-logout", "route.ts"), "utf8");
    expect(auth).toContain("resolveAuthCookiePolicy(");
    expect(logout).toContain("resolveAuthCookiePolicy(");
    expect(logout).not.toContain('".todo.law"');
  });
});
