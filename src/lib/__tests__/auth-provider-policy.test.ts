// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Passwordless sign-in providers must never register on hosted production,
 * whatever the env vars say. Two layers: the pure policy, and the provider
 * list NextAuth actually receives when `@/lib/auth` loads under a given env.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveAuthProviderPolicy } from "@/lib/auth-provider-policy";

vi.mock("@/lib/prisma", () => ({ default: { user: {} } }));
vi.mock("@/lib/email", () => ({
  getResend: () => {
    throw new Error("no mailer in tests");
  },
}));

const ALL_REQUESTED = {
  NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true",
  TESTER_MODE_ENABLED: "true",
  E2E_CREDENTIALS_SECRET: "s3cret",
};

describe("resolveAuthProviderPolicy", () => {
  it("refuses all three on hosted production, even with the opt-in", () => {
    const policy = resolveAuthProviderPolicy({
      ...ALL_REQUESTED,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      ALLOW_TEST_AUTH_PROVIDERS: "true",
    });
    expect(policy).toMatchObject({ local: false, tester: false, e2e: false });
    expect(policy.refused).toEqual(["local", "tester", "e2e-credentials"]);
  });

  it("keeps local auth but refuses test providers on a self-host production build", () => {
    const policy = resolveAuthProviderPolicy({ ...ALL_REQUESTED, NODE_ENV: "production" });
    expect(policy).toMatchObject({ local: true, tester: false, e2e: false });
    expect(policy.refused).toEqual(["tester", "e2e-credentials"]);
  });

  it("allows test providers on a non-hosted production build with the explicit opt-in", () => {
    const policy = resolveAuthProviderPolicy({
      ...ALL_REQUESTED,
      NODE_ENV: "production",
      ALLOW_TEST_AUTH_PROVIDERS: "true",
    });
    expect(policy).toMatchObject({ local: true, tester: true, e2e: true, refused: [] });
  });

  it("allows everything requested on a Vercel preview in development mode", () => {
    const policy = resolveAuthProviderPolicy({
      ...ALL_REQUESTED,
      NODE_ENV: "development",
      VERCEL_ENV: "preview",
    });
    expect(policy).toMatchObject({ local: true, tester: true, e2e: true, refused: [] });
  });

  it("registers nothing that was not requested", () => {
    const policy = resolveAuthProviderPolicy({ NODE_ENV: "development" });
    expect(policy).toEqual({ local: false, tester: false, e2e: false, refused: [] });
  });
});

describe("authOptions.providers on a production build", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function providerIds(env: Record<string, string>) {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { authOptions } = await import("@/lib/auth");
    // next-auth v4 keeps a custom provider id in `options`, merged at request time.
    return authOptions.providers.map(
      (p) => (p as { options?: { id?: string } }).options?.id ?? p.id,
    );
  }

  it("excludes local, tester and e2e providers on hosted production", async () => {
    const ids = await providerIds({
      ...ALL_REQUESTED,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      ALLOW_TEST_AUTH_PROVIDERS: "true",
    });
    expect(ids).not.toContain("local");
    expect(ids).not.toContain("tester");
    expect(ids).not.toContain("e2e-credentials");
  });

  it("excludes tester and e2e providers on a production build without the opt-in", async () => {
    const ids = await providerIds({ ...ALL_REQUESTED, NODE_ENV: "production" });
    expect(ids).toContain("local");
    expect(ids).not.toContain("tester");
    expect(ids).not.toContain("e2e-credentials");
  });

  it("registers the test providers outside production", async () => {
    const ids = await providerIds({ ...ALL_REQUESTED, NODE_ENV: "test" });
    expect(ids).toEqual(expect.arrayContaining(["local", "tester", "e2e-credentials"]));
  });
});
