// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Guide copy: the DPA page's line to a law firm under the price line (same
 * tab, DPA only), the CCPA question on both DPA pages, and the definition
 * that opens the Spanish NDA page; FAQ entries reach the structured data.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PAGE_LOCALES, loadContractPage } from "../contract-pages";
import { contractPageJsonLd } from "../contract-pages-seo";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/contracts",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/config/features", () => ({ features: { publicDocs: true, stripeEnabled: false } }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

describe("DPA guide: the lawyer line", () => {
  it.each(PAGE_LOCALES)("shows under the price line on the DPA page only, same tab (%s)", async (locale) => {
    const { ContractGuidePage } = await import("@/components/contracts/ContractGuidePage");
    const dpa = renderToStaticMarkup(createElement(ContractGuidePage, { slug: "data-processing-agreement", locale }));
    const href =
      locale === "es"
        ? "https://northend.law/guides/do-you-need-a-dpa?lang=es"
        : "https://northend.law/guides/do-you-need-a-dpa";
    const at = dpa.indexOf('data-testid="dpa-lawyer-line"');
    const line = dpa.slice(at, dpa.indexOf("</p>", at));
    expect(line).toContain(`href="${href}"`);
    expect(line).not.toContain("target=");
    expect(at).toBeGreaterThan(dpa.indexOf('id="make-it"'));
    const nda = renderToStaticMarkup(createElement(ContractGuidePage, { slug: "nda", locale }));
    expect(nda).not.toContain("dpa-lawyer-line");
  });
});

describe("FAQ additions", () => {
  it("answers the CCPA question on both DPA pages, in the FAQ data too", () => {
    for (const [locale, q] of [
      ["en", "Does the CCPA require a DPA?"],
      ["es", "¿Exige la CCPA un DPA?"],
    ] as const) {
      const page = loadContractPage("data-processing-agreement", locale)!;
      expect(page.faq.map((f) => f.q)).toContain(q);
      expect(JSON.stringify(contractPageJsonLd(page, "x", []))).toContain(q);
    }
  });

  it("opens the Spanish NDA page with the definition, also as the first question", () => {
    const nda = loadContractPage("nda", "es")!;
    expect(nda.faq[0].q).toBe("¿Qué es un NDA?");
    expect(JSON.stringify(contractPageJsonLd(nda, "x", []))).toContain("¿Qué es un NDA?");
    const section = nda.html.slice(nda.html.indexOf("Qué es y cuándo se utiliza"));
    const firstParagraph = section.slice(section.indexOf("<p>"), section.indexOf("</p>"));
    expect(firstParagraph).toContain("Un NDA (acuerdo de confidencialidad) es el contrato");
  });
});
