// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The sitemap's lastModified is the last change of the content behind each
 * contract page (src/lib/page-dates.json, from the git history), never the
 * build or request time; pages without a recorded date carry none.
 */
import { describe, expect, it } from "vitest";
import PAGE_DATES from "../page-dates.json";
import { lastModifiedFor } from "../page-dates";
import { CONTRACT_PAGES, PAGE_LOCALES, SITE_URL, contractPath } from "../contract-pages-paths";
import sitemap from "@/app/sitemap";
import { pageSources } from "../../../scripts/page-dates.mjs";
import { changedPaths } from "../../../scripts/page-dates-diff.mjs";

const dates = PAGE_DATES as Record<string, string>;

describe("page dates", () => {
  it("has a valid past date for every contract page and both indexes", () => {
    const paths = [
      ...PAGE_LOCALES.map((l) => contractPath(l)),
      ...CONTRACT_PAGES.flatMap((p) => PAGE_LOCALES.map((l) => contractPath(l, p.slug))),
    ];
    for (const path of paths) {
      const date = lastModifiedFor(path);
      expect(date, path).toBeInstanceOf(Date);
      expect(date!.getTime(), path).toBeLessThanOrEqual(Date.now());
    }
    expect(Object.keys(dates).sort()).toEqual([...paths].sort());
  });

  it("puts those dates in the sitemap, and no date on pages without one", () => {
    const entries = sitemap();
    const nda = entries.find((e) => e.url === `${SITE_URL}/es/contracts/nda`);
    expect(nda?.lastModified).toEqual(new Date(dates["/es/contracts/nda"]));
    for (const e of entries) {
      const path = e.url.slice(SITE_URL.length) || "/";
      if (dates[path]) expect(e.lastModified, path).toEqual(new Date(dates[path]));
      else expect(e.lastModified, path).toBeUndefined();
    }
  });

  it("returns no date for unknown paths or unreadable values", () => {
    expect(lastModifiedFor("/pricing")).toBeUndefined();
    expect(lastModifiedFor("/x", { "/x": "not a date" })).toBeUndefined();
    expect(lastModifiedFor("/x", { "/x": "2026-10-01T00:00:00.000Z" })).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });

  it("dates a guide by its page and, when it lives here, its skill", () => {
    const sources = pageSources() as unknown as Record<string, string[]>;
    expect(sources["/contracts/data-processing-agreement"]).toEqual([
      "content/contracts/data-processing-agreement.en.md",
      "skills/dpa",
    ]);
    expect(sources["/es/contracts/business-associate-agreement"]).toEqual([
      "content/contracts/business-associate-agreement.es.md",
      "prisma/hosted-skills/baa-negotiator",
    ]);
    // A skill kept outside this repository: the page only.
    expect(sources["/contracts/consulting-agreement"]).toEqual(["content/contracts/consulting-agreement.en.md"]);
    expect(sources["/contracts"].every((f: string) => f.endsWith(".en.md"))).toBe(true);
  });
});

describe("IndexNow change list", () => {
  it("lists only new or re-dated pages", () => {
    const before = { "/contracts/nda": "2026-10-01T00:00:00.000Z", "/contracts/msa": "2026-10-01T00:00:00.000Z" };
    const after = {
      "/contracts/nda": "2026-10-20T00:00:00.000Z",
      "/contracts/msa": "2026-10-01T00:00:00.000Z",
      "/es/contracts/nda": "2026-10-20T00:00:00.000Z",
    };
    expect(changedPaths(before, after)).toEqual(["/contracts/nda", "/es/contracts/nda"]);
    expect(changedPaths(after, after)).toEqual([]);
    expect(changedPaths({}, { "/contracts": "x" })).toEqual(["/contracts"]);
  });

  it("never passes a path with shell or URL characters", () => {
    expect(changedPaths({}, { "/contracts/nda; rm -rf /": "x", "/ok": "x" })).toEqual(["/ok"]);
  });
});
