// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The developer quick start: every setup snippet carries the real address
 * and the key header, the wording has no long dashes and no "usted", and
 * the page is in the sitemap and llms.txt in both languages.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { SITE_URL } from "@/lib/contract-pages-paths";
import {
  KEY_PLACEHOLDER,
  MCP_SNIPPETS,
  MCP_URL,
  curlGenerate,
  curlListTypes,
  exampleAnswer,
  generateBody,
} from "@/lib/developer-snippets";
import { generateContractSchema } from "@/server/services/agent/generateContract";
import { buildDevelopersDoc, developersMarkdown, priceLines, typeRow, type DocContractType } from "@/lib/developers-doc";
import { SECTION_ORDER } from "@/components/developers/copy";

const TYPES: DocContractType[] = [
  {
    contractType: "NDA",
    slug: "nda",
    name: "Non-Disclosure Agreement",
    group: { id: "commercial", name: "Commercial and technology" },
    governingLaws: ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
    languages: ["en", "es"],
    inputs: [
      { id: "dispute-forum-city", required: true, onlyUnder: ["SPAIN"], default: "Madrid" },
      { id: "custom-courts", required: false },
    ],
  },
  {
    contractType: "DPA",
    slug: "data-processing-agreement",
    name: "Data Processing Agreement",
    group: { id: "privacy", name: "Data protection and privacy" },
    governingLaws: ["CALIFORNIA", "SPAIN"],
    languages: ["en"],
    inputs: [{ id: "processing-purpose", required: true }],
  },
];

/** Every string inside a value, functions called with sample arguments. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String((value as (...a: unknown[]) => unknown)(10, "$29"))];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("developer quick start", () => {
  it("points every MCP snippet at the server with the key header", () => {
    expect(MCP_URL).toBe("https://dealroom.todo.law/api/v1/agent/mcp");
    for (const [id, snippet] of Object.entries(MCP_SNIPPETS)) {
      expect(snippet, id).toContain(MCP_URL);
      expect(snippet, id).toContain("Authorization");
    }
    expect(MCP_SNIPPETS.claudeCode).toContain("claude mcp add --transport http dealroom");
    expect(MCP_SNIPPETS.claudeCode).toContain(`Bearer ${KEY_PLACEHOLDER}`);
    // JSON snippets parse.
    for (const id of ["claudeDesktop", "cursor", "vscode", "generic"] as const) {
      expect(() => JSON.parse(MCP_SNIPPETS[id]), id).not.toThrow();
    }
  });

  it("shows a body the one call accepts", () => {
    for (const locale of ["en", "es"] as const) {
      expect(generateContractSchema.safeParse(generateBody(locale)).success).toBe(true);
      expect(curlGenerate(locale)).toContain(`${SITE_URL}/api/v1/agent/contracts`);
      expect(() => JSON.parse(exampleAnswer(locale))).not.toThrow();
    }
    expect(curlListTypes("es")).toBe(`curl ${SITE_URL}/api/v1/agent/contract-types?lang=es`);
  });

  it("has no long dashes, and the Spanish never says usted", () => {
    for (const locale of ["en", "es"] as const) {
      for (const text of [...strings(DEVELOPERS_COPY[locale]), ...Object.values(MCP_SNIPPETS), curlGenerate(locale)]) {
        expect(text, text).not.toMatch(/[\u2013\u2014]/);
      }
    }
    for (const text of strings(DEVELOPERS_COPY.es)) {
      expect(text, text).not.toMatch(/\busted(es)?\b/i);
    }
  });

  it("is in the sitemap, with its language alternates", () => {
    const entries = sitemap();
    const en = entries.find((e) => e.url === `${SITE_URL}/developers`);
    const es = entries.find((e) => e.url === `${SITE_URL}/es/developers`);
    expect(en?.alternates?.languages).toEqual({ en: `${SITE_URL}/developers`, es: `${SITE_URL}/es/developers` });
    expect(es).toBeTruthy();
    expect(entries.some((e) => e.url === `${SITE_URL}/developers.md`)).toBe(true);
    expect(entries.some((e) => e.url === `${SITE_URL}/es/developers.md`)).toBe(true);
  });

  it("builds the page and its Markdown twin from one object", () => {
    const doc = buildDevelopersDoc({ locale: "en", types: TYPES, prices: ["Price line."], billingOn: true });
    const md = developersMarkdown(doc);
    // Every section, in the fixed order, with its stable anchor.
    expect(doc.toc.map((t) => t.id)).toEqual(SECTION_ORDER);
    const at = SECTION_ORDER.map((id) => md.indexOf(`<a id="${id}"></a>`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(md.match(/^# /gm)).toHaveLength(1);
    // Contract types: one table per group, same columns for every row.
    expect(md).toContain("### Commercial and technology");
    expect(md).toContain(
      "| [Non-Disclosure Agreement](https://dealroom.todo.law/contracts/nda) | `NDA` | California, England and Wales, Spain | English, Spanish | `dispute-forum-city (only under Spain; if left out, the default Madrid is applied)` |",
    );
    expect(md).toContain("| [Data Processing Agreement](https://dealroom.todo.law/contracts/data-processing-agreement) | `DPA` | California, Spain | English | `processing-purpose` |");
    const rows = md.split("\n").filter((l) => l.startsWith("| ["));
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.split(" | ")).toHaveLength(5);
    expect(md).toContain("Price line.");
    expect(md).toContain("https://dealroom.todo.law/developers.md");
    expect(md).not.toMatch(/[\u2013\u2014]/);
  });

  it("describes the inputs in Spanish too, and says when there are none", () => {
    expect(typeRow(TYPES[0], "es").inputs).toEqual(["dispute-forum-city (solo con España; si no lo envías, se aplica el valor por defecto Madrid)"]);
    expect(typeRow({ ...TYPES[1], inputs: [] }, "es").inputs).toEqual([]);
    const md = developersMarkdown(buildDevelopersDoc({ locale: "es", types: [{ ...TYPES[1], inputs: [] }], prices: [], billingOn: false }));
    expect(md).toContain("| Ninguno |");
    expect(md).toContain("https://dealroom.todo.law/es/developers.md");
  });

  it("says where the list lives when the catalogue cannot be read", () => {
    const md = developersMarkdown(buildDevelopersDoc({ locale: "en", types: [], prices: [], billingOn: false }));
    expect(md).toContain("GET /api/v1/agent/contract-types returns it.");
  });

  it("shows the price in the visitor's one currency, from the pricing facts", () => {
    const facts = { contract: { usd: "$29", eur: "29 €" }, pack: { usd: "$250", eur: "250 €" }, packSize: 10 } as never;
    expect(priceLines("en", { billingOn: true, facts, currency: "eur" })[0]).toContain("29 €");
    expect(priceLines("en", { billingOn: true, facts, currency: "usd" })[1]).toContain("$250 a pack");
    expect(priceLines("es", { billingOn: false, facts: null, currency: "usd" })).toEqual([
      "En esta instancia los pagos están desactivados. Todos los contratos son gratis.",
    ]);
  });

  it("is in llms.txt with the one call and the MCP address", () => {
    const llms = readFileSync(join(process.cwd(), "public", "llms.txt"), "utf8");
    expect(llms).toContain(`${SITE_URL}/developers`);
    expect(llms).toContain(`${SITE_URL}/es/developers`);
    expect(llms).toContain("POST https://dealroom.todo.law/api/v1/agent/contracts");
    expect(llms).toContain(MCP_URL);
    expect(llms).toContain(`${SITE_URL}/developers.md`);
    expect(llms).toContain("/document/md");
  });

  it("keeps server.json in line with the page", () => {
    const server = JSON.parse(readFileSync(join(process.cwd(), "server.json"), "utf8"));
    expect(server.remotes[0].url).toBe(MCP_URL);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.description).toMatch(/one call/);
  });
});
