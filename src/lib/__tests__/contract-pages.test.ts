// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_PAGES,
  PAGE_LOCALES,
  SITE_URL,
  contractPath,
  loadContractPage,
  markdownToHtml,
  pageForSlug,
  parseFrontMatter,
} from "../contract-pages";
import { catalogueEntries } from "../skill-catalogue";
import { allContractPaths, contractAlternates } from "../contract-pages-seo";
import { safeNextPath, signInHref } from "../sign-in-next";
import sitemap from "@/app/sitemap";

const pages = CONTRACT_PAGES.flatMap((def) =>
  PAGE_LOCALES.map((locale) => ({ def, locale, page: loadContractPage(def.slug, locale) })),
);

describe("contract pages cover the catalogue", () => {
  it("has a page for every contract type in the catalogue, and no page without one", () => {
    const catalogue = catalogueEntries().map((e) => e.contractType).sort();
    const covered = CONTRACT_PAGES.map((p) => p.contractType).sort();
    expect(covered).toEqual(catalogue);
  });

  it("uses each slug once", () => {
    const slugs = CONTRACT_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has no content file without a page", () => {
    const dir = join(process.cwd(), "content", "contracts");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md")) {
      const match = file.match(/^(.+)\.(en|es)\.md$/);
      expect(match, file).not.toBeNull();
      expect(pageForSlug(match![1]), file).toBeDefined();
    }
  });
});

describe.each(pages.map((p) => [`${p.def.slug}.${p.locale}`, p] as const))("%s", (_name, { def, locale, page }) => {
  it("exists with title, description, heading and summary", () => {
    expect(page).not.toBeNull();
    expect(page!.contractType).toBe(def.contractType);
    expect(page!.title.length).toBeGreaterThanOrEqual(20);
    expect(page!.title.length).toBeLessThanOrEqual(75);
    expect(page!.title).not.toMatch(/\|\s*Dealroom/);
    expect(page!.description.length).toBeGreaterThanOrEqual(100);
    expect(page!.description.length).toBeLessThanOrEqual(200);
    expect(page!.heading).not.toBe("");
    expect(page!.summary).not.toBe("");
  });

  it("has four or five questions with answers", () => {
    expect(page!.faq.length).toBeGreaterThanOrEqual(4);
    expect(page!.faq.length).toBeLessThanOrEqual(5);
    for (const f of page!.faq) {
      expect(f.q.trim()).not.toBe("");
      expect(f.a.trim()).not.toBe("");
    }
  });

  it("has a body of guide length", () => {
    expect(page!.wordCount).toBeGreaterThanOrEqual(180);
    expect(page!.wordCount).toBeLessThanOrEqual(1700);
  });

  it("uses no long dashes", () => {
    const source = readFileSync(join(process.cwd(), "content", "contracts", `${def.slug}.${locale}.md`), "utf8");
    expect(source).not.toMatch(/[–—]/);
  });

  it("links only to existing pages in its own language", () => {
    for (const slug of page!.related) expect(pageForSlug(slug), slug).toBeDefined();
    const prefix = locale === "es" ? "/es/contracts/" : "/contracts/";
    for (const [, href] of page!.body.matchAll(/\]\(([^)]+)\)/g)) {
      if (!href.includes("/contracts/")) continue;
      expect(href.startsWith(prefix), href).toBe(true);
      expect(pageForSlug(href.slice(prefix.length).split("#")[0]), href).toBeDefined();
    }
  });
});

describe("titles and descriptions are unique per language", () => {
  it.each(PAGE_LOCALES)("%s", (locale) => {
    const own = pages.filter((p) => p.locale === locale).map((p) => p.page!);
    expect(new Set(own.map((p) => p.title)).size).toBe(own.length);
    expect(new Set(own.map((p) => p.description)).size).toBe(own.length);
  });
});

describe("discovery", () => {
  it("lists every page, in both languages, in the sitemap with alternates", () => {
    const urls = sitemap().map((e) => e.url);
    for (const path of allContractPaths()) expect(urls).toContain(`${SITE_URL}${path}`);
    const nda = sitemap().find((e) => e.url === `${SITE_URL}/es/contracts/nda`);
    expect(nda?.alternates?.languages).toEqual({
      en: `${SITE_URL}/contracts/nda`,
      es: `${SITE_URL}/es/contracts/nda`,
    });
  });

  it("lists every page in llms.txt", () => {
    const llms = readFileSync(join(process.cwd(), "public", "llms.txt"), "utf8");
    for (const def of CONTRACT_PAGES) {
      expect(llms, def.slug).toContain(`${SITE_URL}${contractPath("en", def.slug)}`);
      expect(llms, def.slug).toContain(`${SITE_URL}${contractPath("es", def.slug)}`);
    }
  });

  it("gives canonical and hreflang alternates both ways", () => {
    expect(contractAlternates("es", "nda")).toEqual({
      canonical: "/es/contracts/nda",
      languages: { en: "/contracts/nda", es: "/es/contracts/nda", "x-default": "/contracts/nda" },
    });
  });
});

describe("content format", () => {
  it("parses front matter with questions", () => {
    const { data, body } = parseFrontMatter(
      '---\ntitle: "A \\"quoted\\" title"\nrelated: ["nda", "msa"]\nfaq:\n  - q: "One?"\n    a: "Yes."\n  - q: "Two?"\n    a: "No."\n---\n## Body\n',
    );
    expect(data.title).toBe('A "quoted" title');
    expect(data.related).toEqual(["nda", "msa"]);
    expect(data.faq).toEqual([
      { q: "One?", a: "Yes." },
      { q: "Two?", a: "No." },
    ]);
    expect(body).toBe("## Body\n");
  });

  it("renders the Markdown subset and escapes HTML", () => {
    const html = markdownToHtml(
      "## What it is\n\nA **firm** and *fair* deal <script>.\n\n- one\n- [two](/contracts/nda)\n\n1. first\n2. [bad](javascript:alert)\n",
    );
    expect(html).toContain('<h2 id="what-it-is">What it is</h2>');
    expect(html).toContain("<strong>firm</strong>");
    expect(html).toContain("<em>fair</em>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<li><a href="/contracts/nda">two</a></li>');
    expect(html).toContain("<ol><li>first</li><li>bad</li></ol>");
    expect(html).not.toContain("javascript:");
  });
});

describe("sign-in return path", () => {
  it("keeps site paths and drops anything else", () => {
    expect(safeNextPath("/deals/new?q=NDA")).toBe("/deals/new?q=NDA");
    expect(safeNextPath(null)).toBe("/deals");
    expect(safeNextPath("https://elsewhere.example")).toBe("/deals");
    expect(safeNextPath("//elsewhere.example")).toBe("/deals");
    expect(safeNextPath("/\\elsewhere.example")).toBe("/deals");
    expect(signInHref("/deals/new?q=NDA")).toBe("/sign-in?next=%2Fdeals%2Fnew%3Fq%3DNDA");
  });
});
