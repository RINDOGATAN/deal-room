// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot posture in the feature flags: on the hosted build every
 * skill is free and nothing is sold, even if the Stripe variables are still
 * set; the kit keeps its own posture (no pilot, installer on).
 */
import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_ENABLED",
  "FREE_TRIAL_ALL_SKILLS",
  "NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS",
  "NEXT_PUBLIC_LOCAL_AUTH_ENABLED",
  "VERCEL_ENV",
  "AUTH_COOKIE_DOMAIN",
  "NEXT_PUBLIC_HOSTED_PILOT",
] as const;

const ORIGINAL: Record<string, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((k) => [k, process.env[k]]),
);

async function featuresUnder(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  vi.resetModules();
  return (await import("@/config/features")).features;
}

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL[k];
  }
  vi.resetModules();
});

describe("hosted pilot posture", () => {
  it("makes every skill free and turns selling off, even with Stripe variables set", async () => {
    const features = await featuresUnder({
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
    });
    expect(features.hostedPilot).toBe(true);
    expect(features.allSkillsFree).toBe(true);
    expect(features.stripeEnabled).toBe(false);
    expect(features.billing).toBe(false);
    expect(features.selfServiceUpgrade).toBe(false);
    // No .skill uploads on the pilot: every skill is already there.
    expect(features.skillInstaller).toBe(false);
  });

  it("reaches the browser bundle through the build-time flag", async () => {
    const features = await featuresUnder({
      NEXT_PUBLIC_HOSTED_PILOT: "true",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
    });
    expect(features.hostedPilot).toBe(true);
    expect(features.stripeEnabled).toBe(false);
  });

  it("leaves the kit unchanged: no pilot, all skills free, installer on", async () => {
    const features = await featuresUnder({
      NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true",
      AUTH_COOKIE_DOMAIN: "",
      NEXT_PUBLIC_HOSTED_PILOT: "false",
    });
    expect(features.hostedPilot).toBe(false);
    expect(features.allSkillsFree).toBe(true);
    expect(features.skillInstaller).toBe(true);
  });

  it("leaves a non-pilot deployment with Stripe able to sell", async () => {
    const features = await featuresUnder({
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
    });
    expect(features.hostedPilot).toBe(false);
    expect(features.stripeEnabled).toBe(true);
  });
});
