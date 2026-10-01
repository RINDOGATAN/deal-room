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
  "NEXT_PUBLIC_CONTRACT_BILLING",
  "STRIPE_PRICE_CONTRACT_USD",
  "STRIPE_PRICE_CONTRACT_EUR",
  "STRIPE_PRICE_CREDITS_10_USD",
  "STRIPE_PRICE_CREDITS_10_EUR",
  "CONTRACT_BILLING_START",
  // Discarded in round 2; listed so the tests can prove they are not read.
  "STRIPE_PRICE_MONTHLY_USD",
  "STRIPE_PRICE_MONTHLY_EUR",
] as const;

const FIVE_VARS = {
  STRIPE_PRICE_CONTRACT_USD: "price_contract_usd",
  STRIPE_PRICE_CONTRACT_EUR: "price_contract_eur",
  STRIPE_PRICE_CREDITS_10_USD: "price_credits_usd",
  STRIPE_PRICE_CREDITS_10_EUR: "price_credits_eur",
  CONTRACT_BILLING_START: "2026-10-01",
};

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

describe("hosted pay per contract (2026-09-29, round 2: five variables)", () => {
  it("switches billing on and the pilot mechanics off once the five variables are set", async () => {
    const features = await featuresUnder({
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
      ...FIVE_VARS,
    });
    expect(features.stripeEnabled).toBe(true);
    expect(features.billing).toBe(true);
    expect(features.hostedPilot).toBe(false);
    expect(features.hosted).toBe(true);
    // Every template serves; the contract is what is paid.
    expect(features.allSkillsFree).toBe(true);
    expect(features.skillInstaller).toBe(false);
  });

  it.each(Object.keys(FIVE_VARS))("stays free while %s is missing", async (missing) => {
    const four = Object.fromEntries(Object.entries(FIVE_VARS).filter(([k]) => k !== missing));
    const features = await featuresUnder({
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
      ...four,
    });
    expect(features.stripeEnabled).toBe(false);
    expect(features.hostedPilot).toBe(true);
    expect(features.hosted).toBe(true);
  });

  it("stays free when the start date is not a date", async () => {
    const features = await featuresUnder({
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
      ...FIVE_VARS,
      CONTRACT_BILLING_START: "next week",
    });
    expect(features.stripeEnabled).toBe(false);
  });

  it("does not need, or read, the discarded monthly variables", async () => {
    const features = await featuresUnder({
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
      ...FIVE_VARS,
      STRIPE_PRICE_MONTHLY_USD: "",
      STRIPE_PRICE_MONTHLY_EUR: "",
    });
    expect(features.stripeEnabled).toBe(true);

    const monthlyOnly = await featuresUnder({
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
      STRIPE_PRICE_MONTHLY_USD: "price_monthly_usd",
      STRIPE_PRICE_MONTHLY_EUR: "price_monthly_eur",
    });
    expect(monthlyOnly.stripeEnabled).toBe(false);
  });

  it("reaches the browser bundle through the inlined contract-billing flag", async () => {
    const features = await featuresUnder({
      NEXT_PUBLIC_HOSTED_PILOT: "true",
      NEXT_PUBLIC_STRIPE_ENABLED: "true",
      NEXT_PUBLIC_CONTRACT_BILLING: "true",
    });
    expect(features.stripeEnabled).toBe(true);
    expect(features.hostedPilot).toBe(false);
    expect(features.hosted).toBe(true);
  });

  it("leaves the kit all free even with the price variables present", async () => {
    const features = await featuresUnder({
      NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true",
      NEXT_PUBLIC_HOSTED_PILOT: "false",
      ...FIVE_VARS,
    });
    expect(features.stripeEnabled).toBe(false);
    expect(features.hosted).toBe(false);
    expect(features.allSkillsFree).toBe(true);
    expect(features.skillInstaller).toBe(true);
  });
});
