// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Payment-free guarantee.
 *
 * When payments are disabled (no STRIPE_SECRET_KEY) every premium skill must
 * be free for everyone, and that must NOT depend on remembering to set the
 * FREE_TRIAL_ALL_SKILLS promo env var. Dropping Stripe alone unlocks skills.
 *
 * These tests reload `@/config/features` (and the entitlement service) under
 * different env combinations. @/lib/prisma is mocked so the entitlement check
 * is hermetic and never touches a DB.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const p = {
    skillPackage: { findUnique: vi.fn() },
    skillEntitlement: { findUnique: vi.fn(), update: vi.fn() },
    contractTemplate: { findUnique: vi.fn() },
  };
  return { prisma: p, default: p };
});

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "FREE_TRIAL_ALL_SKILLS",
  "NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS",
] as const;

const ORIGINAL: Record<string, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((k) => [k, process.env[k]]),
);

function setEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
}

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL[k];
  }
  vi.resetModules();
  vi.clearAllMocks();
});

describe("features.allSkillsFree", () => {
  it("unlocks all skills when Stripe is absent, even with no promo env set", async () => {
    setEnv({});
    vi.resetModules();
    const { features } = await import("@/config/features");
    expect(features.stripeEnabled).toBe(false);
    expect(features.allSkillsFree).toBe(true);
  });

  it("keeps skills gated when Stripe is configured and no promo is set", async () => {
    setEnv({ STRIPE_SECRET_KEY: "sk_test_dummy" });
    vi.resetModules();
    const { features } = await import("@/config/features");
    expect(features.stripeEnabled).toBe(true);
    expect(features.allSkillsFree).toBe(false);
  });

  it("still honors the promo env while Stripe stays configured", async () => {
    setEnv({ STRIPE_SECRET_KEY: "sk_test_dummy", FREE_TRIAL_ALL_SKILLS: "true" });
    vi.resetModules();
    const { features } = await import("@/config/features");
    expect(features.stripeEnabled).toBe(true);
    expect(features.allSkillsFree).toBe(true);
  });
});

describe("skill-access with payments disabled", () => {
  it("resolves an entitlement check to allowed/free when Stripe is absent, without touching the DB", async () => {
    setEnv({});
    vi.resetModules();
    const { checkEntitlement } = await import(
      "@/server/services/licensing/entitlement"
    );
    const prismaMod = await import("@/lib/prisma");

    const result = await checkEntitlement("cust-1", "nda-premium");

    expect(result.entitled).toBe(true);
    expect(
      (prismaMod.default as unknown as {
        skillPackage: { findUnique: ReturnType<typeof vi.fn> };
      }).skillPackage.findUnique,
    ).not.toHaveBeenCalled();
  });
});
