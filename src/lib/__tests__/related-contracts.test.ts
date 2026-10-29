// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Related contracts" on each guide: three or four links to other guides in
 * the same language, the page's own family list first, then the same
 * group, then the key guides; and they are in the server-rendered HTML.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONTRACT_PAGES,
  KEY_CONTRACT_SLUGS,
  PAGE_LOCALES,
  RELATED_MAX,
  RELATED_MIN,
  chooseRelated,
  contractPath,
  loadContractPage,
  pageForSlug,
} from "../contract-pages";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/contracts",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/config/features", () => ({ features: { publicDocs: true, stripeEnabled: false } }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

const all = () => true;

describe("chooseRelated", () => {
  it("keeps the family list, in order, up to four", () => {
    expect(chooseRelated("x", ["nda", "saas-agreement", "consulting-agreement"], all)).toEqual([
      "nda",
      "saas-agreement",
      "consulting-agreement",
    ]);
    expect(
      chooseRelated("convertible-note", ["safe-agreement", "term-sheet", "seed-investment-agreement", "shareholders-agreement", "founders-agreement"], all),
    ).toEqual(["safe-agreement", "term-sheet", "seed-investment-agreement", "shareholders-agreement"]);
  });

  it("drops itself, duplicates, unknown slugs and pages missing in the language", () => {
    expect(
      chooseRelated("nda", ["nda", "saas-agreement", "saas-agreement", "no-such-page", "msa", "consulting-agreement", "advisory-agreement"], (s) => s !== "consulting-agreement"),
      // Topped up from the NDA's own group (commercial), key guides first.
    ).toEqual(["saas-agreement", "advisory-agreement", "software-development-agreement"]);
  });

  it("tops up a short list from the same group, then the key guides", () => {
    // Property has three pages: the two siblings, then the first key guide.
    expect(chooseRelated("assured-periodic-tenancy", ["california-residential-lease", "residential-lease-spain"], all)).toEqual([
      "california-residential-lease",
      "residential-lease-spain",
      KEY_CONTRACT_SLUGS[0],
    ]);
    // Same group first, key guides of that group ahead of the others.
    expect(chooseRelated("privacy-notice", [], all)).toEqual([
      "data-processing-agreement",
      "business-associate-agreement",
      "data-licensing-agreement",
    ]);
    expect(chooseRelated("term-sheet", [], all)).toEqual(["convertible-note", "delaware-certificate-of-incorporation", "founders-agreement"]);
  });

  it("names only real guides as key guides", () => {
    for (const s of KEY_CONTRACT_SLUGS) expect(pageForSlug(s), s).toBeDefined();
  });
});

describe.each(PAGE_LOCALES)("every guide page (%s)", (locale) => {
  it("links three or four other guides in the same language", () => {
    for (const def of CONTRACT_PAGES) {
      const page = loadContractPage(def.slug, locale)!;
      const related = chooseRelated(def.slug, page.related, (s) => loadContractPage(s, locale) !== null);
      expect(related.length, def.slug).toBeGreaterThanOrEqual(RELATED_MIN);
      expect(related.length, def.slug).toBeLessThanOrEqual(RELATED_MAX);
      expect(related, def.slug).not.toContain(def.slug);
    }
  });

  it("renders the links in the server HTML", async () => {
    const { ContractGuidePage } = await import("@/components/contracts/ContractGuidePage");
    const html = renderToStaticMarkup(createElement(ContractGuidePage, { slug: "data-processing-agreement", locale }));
    const heading = locale === "es" ? "Contratos relacionados" : "Related contracts";
    const section = html.slice(html.indexOf(heading));
    expect(section.length).toBeLessThan(html.length);
    const page = loadContractPage("data-processing-agreement", locale)!;
    const expected = chooseRelated("data-processing-agreement", page.related, () => true);
    for (const slug of expected) expect(section).toContain(`href="${contractPath(locale, slug)}"`);
    // One related block only.
    expect(html.split(heading).length - 1).toBe(1);
  });
});
