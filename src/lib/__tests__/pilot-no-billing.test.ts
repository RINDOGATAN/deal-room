// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot: nothing is sold, so /billing is not reachable and nothing
 * in the app links to it. The kit (and any non-pilot deployment with Stripe)
 * keeps the page and its link exactly as before.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";

vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const PILOT_KEYS = ["NEXT_PUBLIC_HOSTED_PILOT", "VERCEL_ENV", "AUTH_COOKIE_DOMAIN"] as const;
const FEATURE_KEYS = [
  ...PILOT_KEYS,
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_ENABLED",
  "NEXT_PUBLIC_LOCAL_AUTH_ENABLED",
] as const;
type Env = Partial<Record<(typeof FEATURE_KEYS)[number], string>>;

const PILOT: Env = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_HOSTED_PILOT: "true",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  NEXT_PUBLIC_STRIPE_ENABLED: "true",
};
const KIT: Env = { NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true", NEXT_PUBLIC_HOSTED_PILOT: "false" };
const STRIPE_NON_PILOT: Env = {
  NEXT_PUBLIC_HOSTED_PILOT: "false",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  NEXT_PUBLIC_STRIPE_ENABLED: "true",
};

function setEnv(env: Env) {
  for (const k of FEATURE_KEYS) vi.stubEnv(k, env[k] ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function get(path: string) {
  return middleware(new NextRequest(`https://dealroom.todo.law${path}`));
}

function redirectTarget(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

async function featuresUnder(env: Env) {
  setEnv(env);
  vi.resetModules();
  return (await import("@/config/features")).features;
}

describe("/billing on the hosted pilot", () => {
  it.each(["/billing", "/billing/", "/billing?success=true&session_id=cs_1"])(
    "redirects %s to Settings",
    async (path) => {
      setEnv(PILOT);
      const res = await get(path);
      expect(res.status).toBe(307);
      expect(redirectTarget(res)).toBe("/settings");
    },
  );

  it("also redirects when only the server-side Vercel signal is present", async () => {
    setEnv({ VERCEL_ENV: "production" });
    expect(redirectTarget(await get("/billing"))).toBe("/settings");
  });

  it("leaves other pages alone", async () => {
    setEnv(PILOT);
    for (const path of ["/settings", "/deals", "/billing-help"]) {
      const res = await get(path);
      expect(redirectTarget(res)).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("turns the billing flag (the only gate on the nav links) off", async () => {
    const features = await featuresUnder(PILOT);
    expect(features.billing).toBe(false);
  });
});

describe("/billing off the pilot is unchanged", () => {
  it.each([
    ["kit", KIT],
    ["non-pilot deployment with Stripe", STRIPE_NON_PILOT],
  ])("the %s lets /billing through to the page", async (_label, env) => {
    setEnv(env);
    const res = await get("/billing");
    expect(redirectTarget(res)).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("a non-pilot deployment with Stripe still shows the billing page and link", async () => {
    const features = await featuresUnder(STRIPE_NON_PILOT);
    expect(features.hostedPilot).toBe(false);
    expect(features.billing).toBe(true);
  });

  it("the kit keeps its own posture (no Stripe, so no billing, as before)", async () => {
    const features = await featuresUnder(KIT);
    expect(features.hostedPilot).toBe(false);
    expect(features.billing).toBe(false);
  });
});

describe("links to /billing", () => {
  // Every in-app link to /billing must sit behind `features.billing`, which
  // the pilot turns off. Server-built URLs (Stripe return URLs, e-mails) are
  // only produced when Stripe is on and are outside src/app/(dashboard) and
  // src/components.
  function tsxFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return tsxFiles(full);
      return full.endsWith(".tsx") ? [full] : [];
    });
  }

  const root = join(__dirname, "../../..");
  const files = [
    ...tsxFiles(join(root, "src/app/(dashboard)")),
    ...tsxFiles(join(root, "src/components")),
  ].filter((f) => !f.includes(join("(dashboard)", "billing")));

  it("finds the navigation links it guards", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes('href="/billing"'));
    expect(hits.length).toBeGreaterThan(0);
  });

  it("puts every one behind features.billing", () => {
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/["'`]\/billing(?:["'`?/])/.test(line)) return;
        const before = lines.slice(Math.max(0, i - 4), i).join("\n");
        expect(before, `${file}:${i + 1}`).toMatch(/features\.billing &&/);
      });
    }
  });
});
