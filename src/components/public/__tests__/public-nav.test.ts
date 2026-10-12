// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One navigation on every public page: the home, the
 * contract guides, Developers, Docs (and its agent API section) and Pricing
 * show the same header links in the same order; the documentation is called
 * "Docs" ("Documentación"), never "User Guide"; Spanish pages never show a
 * dollar price.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/config/features", () => ({ features: { publicDocs: true, stripeEnabled: true } }));

const { PublicHeader } = await import("../PublicHeader");
const { navSectionFor } = await import("../nav-copy");
const { displayCurrency } = await import("@/lib/currency");

const ROOT = path.resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** The desktop header links (text and href), in order. */
function headerLinks(locale: "en" | "es", at: string): string[] {
  pathname = at;
  const html = renderToStaticMarkup(createElement(PublicHeader, { locale, languageHref: "/x" }));
  const nav = html.slice(html.indexOf('data-testid="nav-links"'));
  return [...nav.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map((m) => `${m[2]} ${m[1]}`)
    .filter((l) => !l.startsWith("/x"));
}

const PAGES = ["/", "/contracts", "/es/contracts/employment-contract-spain", "/developers", "/es/developers", "/docs", "/docs/agent-api", "/pricing"];

describe("one header on every public page", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it.each(["en", "es"] as const)("shows the same links in the same order everywhere (%s)", (locale) => {
    const expected =
      locale === "en"
        ? ["Contracts /contracts", "Developers /developers", "Agents /docs/agent-api", "Docs /docs", "Pricing /pricing", "EN /x", "Sign in /sign-in"]
        : ["Contratos /es/contracts", "Desarrolladores /es/developers", "Agentes /docs/agent-api", "Documentación /docs", "Precios /pricing", "EN /x", "Iniciar sesión /sign-in"];
    for (const at of PAGES) {
      const links = headerLinks(locale, at).filter((l) => !/^(ES|EN) /.test(l));
      expect(links, at).toEqual(expected.filter((l) => !/^(ES|EN) /.test(l)));
    }
  });

  it("marks the current section from the path", () => {
    expect(navSectionFor("/")).toBeNull();
    expect(navSectionFor("/es/contracts/employment-contract-spain")).toBe("contracts");
    expect(navSectionFor("/developers")).toBe("developers");
    expect(navSectionFor("/es/developers")).toBe("developers");
    expect(navSectionFor("/docs/agent-api")).toBe("agents");
    expect(navSectionFor("/docs/how-it-works")).toBe("docs");
    expect(navSectionFor("/pricing")).toBe("pricing");
  });

  it("is the header and footer of the home, the contract pages, Developers, Docs and Pricing", () => {
    for (const rel of ["src/landing/LandingPage.tsx", "src/components/contracts/ContractsShell.tsx", "src/app/(public)/client-layout.tsx"]) {
      const src = read(rel);
      expect(src, rel).toContain("<PublicHeader");
      expect(src, rel).toContain("<PublicFooter");
      expect(src, rel).not.toMatch(/<header[\s>]/);
    }
    // Developers renders inside the contract pages' shell.
    expect(read("src/components/developers/DevelopersPage.tsx")).toContain("<ContractsShell");
  });
});

describe("the documentation is called Docs", () => {
  it.each(["src/messages/en.json", "src/messages/es.json", "src/components/public/nav-copy.ts"])("%s never says User Guide", (rel) => {
    expect(read(rel)).not.toMatch(/User Guide|Gu[ií]a de Usuario|Gu[ií]a del usuario/i);
  });

  it("labels the docs link Docs and Documentación", () => {
    const en = JSON.parse(read("src/messages/en.json"));
    const es = JSON.parse(read("src/messages/es.json"));
    expect(en.docs.title).toBe("Docs");
    expect(es.docs.title).toBe("Documentación");
    expect(en.footer.userGuide).toBe("Docs");
    expect(es.footer.userGuide).toBe("Documentación");
  });
});

describe("Spanish pages show euros only", () => {
  it("chooses euros for Spanish whatever the visitor's region", () => {
    expect(displayCurrency("es", "USD")).toBe("EUR");
    expect(displayCurrency("es", "EUR")).toBe("EUR");
    expect(displayCurrency("en", "USD")).toBe("USD");
    expect(displayCurrency("en", "EUR")).toBe("EUR");
  });

  it("routes every public price through that rule", () => {
    expect(read("src/components/contracts/PriceLine.tsx")).toContain("displayCurrency(locale");
    expect(read("src/server/services/developers.ts")).toContain("displayCurrency(locale");
    expect(read("src/hooks/useCurrency.ts")).toContain("displayCurrency(useLocale()");
    const pricing = read("src/app/(public)/pricing/page.tsx");
    expect(pricing).toContain("displayCurrency(");
    expect(pricing).toContain('es ? ["eur"] : undefined');
  });

  it("puts no dollar amount in the Spanish landing copy", () => {
    const es = read("src/landing/i18n/es/dealroom-startups.json");
    expect(es).not.toMatch(/\$\s?\d|\d\s?\$|US\$|USD/);
  });
});
