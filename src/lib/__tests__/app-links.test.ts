// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * No header or footer link may lead to a 404 (owner's test purchase,
 * 2 October 2026: the footer's "Billing" link went to Settings, which
 * 404s once hosted billing is on).
 *
 * For every internal link in the app's headers and footers, and in every
 * posture (hosted pilot, hosted with billing, self-hosted kit):
 * - a page or route exists for the path;
 * - if the link shows in that posture, the middleware lets it through or
 *   redirects it, and the page it finally lands on is not switched off
 *   (`if (!features.X) notFound()` in its layouts) in that posture.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { billingOnEnv, isPilotPostureEnv } from "@/lib/pilot";
import { shouldShowRequestsLink } from "@/lib/app-links";

vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const ENV_KEYS = [
  "NEXT_PUBLIC_HOSTED_PILOT",
  "VERCEL_ENV",
  "AUTH_COOKIE_DOMAIN",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_ENABLED",
  "NEXT_PUBLIC_CONTRACT_BILLING",
  "STRIPE_PRICE_CONTRACT_USD",
  "STRIPE_PRICE_CONTRACT_EUR",
  "STRIPE_PRICE_CREDITS_10_USD",
  "STRIPE_PRICE_CREDITS_10_EUR",
  "CONTRACT_BILLING_START",
  "NEXT_PUBLIC_LOCAL_AUTH_ENABLED",
] as const;
type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>;

const POSTURES: Record<string, Env> = {
  "hosted pilot (billing off)": {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_HOSTED_PILOT: "true",
    STRIPE_SECRET_KEY: "sk_test_dummy",
    NEXT_PUBLIC_STRIPE_ENABLED: "true",
  },
  "hosted with billing on": {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_HOSTED_PILOT: "true",
    STRIPE_SECRET_KEY: "sk_test_dummy",
    NEXT_PUBLIC_STRIPE_ENABLED: "true",
    NEXT_PUBLIC_CONTRACT_BILLING: "true",
    STRIPE_PRICE_CONTRACT_USD: "price_c_usd",
    STRIPE_PRICE_CONTRACT_EUR: "price_c_eur",
    STRIPE_PRICE_CREDITS_10_USD: "price_k_usd",
    STRIPE_PRICE_CREDITS_10_EUR: "price_k_eur",
    CONTRACT_BILLING_START: "2026-10-01",
  },
  "self-hosted kit": { NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true", NEXT_PUBLIC_HOSTED_PILOT: "false" },
};

const root = join(__dirname, "../../..");
const APP = join(root, "src/app");

/** The files that draw a header or a footer. */
const CHROME_FILES = [
  "src/app/(dashboard)/layout.tsx",
  "src/app/(public)/layout.tsx",
  "src/app/(auth)/layout.tsx",
  "src/components/contracts/ContractsHeader.tsx",
  "src/components/contracts/ContractsShell.tsx",
  "src/landing/components/StartupsHeader.tsx",
  "src/landing/components/StartupsFooter.tsx",
];

interface FoundLink {
  file: string;
  line: number;
  path: string;
  /** `features.X` (or `!features.X`) conditions that must hold for the link to show. */
  flags: { name: string; negated: boolean }[];
}

/** Literal internal links (`href="/x"`, `href: "/x"`) and the feature flags guarding them. */
function chromeLinks(): FoundLink[] {
  const links: FoundLink[] = [];
  for (const file of CHROME_FILES) {
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    lines.forEach((text, i) => {
      for (const m of text.matchAll(/href(?:=|:\s*)["'](\/[^"'#?]*)/g)) {
        // The guard sits just above the link, after the previous link.
        let start = i;
        while (start > Math.max(0, i - 6) && !lines[start - 1].includes("href")) start--;
        const before = lines.slice(start, i + 1).join("\n");
        const flags = [...before.matchAll(/(!?)features\.(\w+)/g)].map((f) => ({
          name: f[2],
          negated: f[1] === "!",
        }));
        links.push({ file, line: i + 1, path: m[1], flags });
      }
    });
  }
  return links;
}

function visible(link: FoundLink, features: Record<string, unknown>): boolean {
  return link.flags.every((f) => (features[f.name] === true) !== f.negated);
}

/** Directories under src/app whose URL is `path` (route groups are transparent). */
function routeDirs(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  let dirs = [APP];
  const expandGroups = (ds: string[]) => {
    const out: string[] = [];
    const visit = (d: string) => {
      out.push(d);
      for (const name of readdirSync(d)) {
        const full = join(d, name);
        if (name.startsWith("(") && statSync(full).isDirectory()) visit(full);
      }
    };
    ds.forEach(visit);
    return out;
  };
  for (const seg of segments) {
    dirs = expandGroups(dirs).flatMap((d) => {
      const exact = join(d, seg);
      if (existsSync(exact) && statSync(exact).isDirectory()) return [exact];
      const dynamic = readdirSync(d).find((n) => /^\[[^.\]]+\]$/.test(n));
      return dynamic ? [join(d, dynamic)] : [];
    });
  }
  return expandGroups(dirs).filter(
    (d) => ["page.tsx", "page.ts", "route.ts"].some((f) => existsSync(join(d, f))),
  );
}

/** `features.X` flags that a layout on the way to `dir` requires (`if (!features.X) notFound()`). */
function layoutGates(dir: string): string[] {
  const gates: string[] = [];
  for (let d = dir; d.startsWith(APP); d = join(d, "..")) {
    const layout = join(d, "layout.tsx");
    if (existsSync(layout)) {
      const src = readFileSync(layout, "utf8");
      for (const m of src.matchAll(/if \(!features\.(\w+)\) notFound\(\)/g)) gates.push(m[1]);
    }
    if (d === APP) break;
  }
  return gates;
}

function setEnv(env: Env) {
  for (const k of ENV_KEYS) vi.stubEnv(k, env[k] ?? "");
}

async function featuresUnder(env: Env): Promise<Record<string, unknown>> {
  setEnv(env);
  vi.resetModules();
  return (await import("@/config/features")).features as unknown as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("header and footer links", () => {
  const links = chromeLinks();

  it("finds the links it checks, the billing link among them", () => {
    expect(links.length).toBeGreaterThan(10);
    expect(links.some((l) => l.path === "/billing" && l.flags.some((f) => f.name === "billing"))).toBe(true);
    expect(links.some((l) => l.path === "/lawyers/requests")).toBe(true);
  });

  it("every internal link has a page or route", () => {
    for (const link of links) {
      expect(routeDirs(link.path), `${link.file}:${link.line} ${link.path}`).not.toHaveLength(0);
    }
  });

  it.each(Object.entries(POSTURES))("in the %s posture, every visible link lands on a live page", async (_name, env) => {
    const features = await featuresUnder(env);
    for (const link of links) {
      if (!visible(link, features)) continue; // hidden in this posture
      const res = await middleware(new NextRequest(`https://dealroom.todo.law${link.path}`));
      const location = res.headers.get("location");
      const landing = location ? new URL(location).pathname : link.path;
      const where = `${link.file}:${link.line} ${link.path} -> ${landing}`;
      const dirs = routeDirs(landing);
      expect(dirs, where).not.toHaveLength(0);
      const live = dirs.some((d) => layoutGates(d).every((g) => features[g] === true));
      expect(live, where).toBe(true);
    }
  });

  it("the billing link goes to the billing page itself when billing is on", async () => {
    setEnv(POSTURES["hosted with billing on"]);
    const res = await middleware(new NextRequest("https://dealroom.todo.law/billing"));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("posture rule shared with the middleware", () => {
  it.each(Object.entries(POSTURES))("agrees with the feature flags in the %s posture", async (_name, env) => {
    const features = await featuresUnder(env);
    expect(billingOnEnv(env)).toBe(features.stripeEnabled);
    expect(isPilotPostureEnv(env)).toBe(features.hostedPilot);
  });
});

describe("requests link", () => {
  it("shows only once the person has sent or received a request", () => {
    expect(shouldShowRequestsLink(undefined)).toBe(false);
    expect(shouldShowRequestsLink(null)).toBe(false);
    expect(shouldShowRequestsLink(0)).toBe(false);
    expect(shouldShowRequestsLink(1)).toBe(true);
    expect(shouldShowRequestsLink(12)).toBe(true);
  });

  it("is gated on the count in the footer, not on the lawyer role", () => {
    const src = readFileSync(join(root, "src/app/(dashboard)/layout.tsx"), "utf8");
    const at = src.indexOf('href="/lawyers/requests"');
    const before = src.slice(Math.max(0, at - 300), at);
    expect(before).toContain("showRequestsLink &&");
    expect(before).not.toContain('userRole === "LAWYER" &&');
  });

  it("has a plain label in both languages", async () => {
    const en = (await import("@/messages/en.json")).default as { nav: Record<string, string> };
    const es = (await import("@/messages/es.json")).default as { nav: Record<string, string> };
    expect(en.nav.requests).toBe("Requests for expert help");
    expect(es.nav.requests).toBe("Solicitudes de ayuda experta");
  });
});
