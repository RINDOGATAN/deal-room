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
        expect(text, text).not.toMatch(/[–—]/);
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
  });

  it("is in llms.txt with the one call and the MCP address", () => {
    const llms = readFileSync(join(process.cwd(), "public", "llms.txt"), "utf8");
    expect(llms).toContain(`${SITE_URL}/developers`);
    expect(llms).toContain(`${SITE_URL}/es/developers`);
    expect(llms).toContain("POST https://dealroom.todo.law/api/v1/agent/contracts");
    expect(llms).toContain(MCP_URL);
  });

  it("keeps server.json in line with the page", () => {
    const server = JSON.parse(readFileSync(join(process.cwd(), "server.json"), "utf8"));
    expect(server.remotes[0].url).toBe(MCP_URL);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.description).toMatch(/one call/);
  });
});
