// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Public text must describe what the product does (owner, 2026-10-02).
 * Guards the corrections made then: one contract-type count everywhere,
 * no encryption or "AI decides" claims the code cannot back, llms.txt
 * links that resolve, and a /docs/skills page whose strings exist.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const LLMS = "public/llms.txt";
const LANDING_EN = "src/landing/i18n/en/dealroom-startups.json";
const LANDING_ES = "src/landing/i18n/es/dealroom-startups.json";
const MESSAGES_EN = "src/messages/en.json";
const MESSAGES_ES = "src/messages/es.json";

/** The contract guides are the list of contract types Dealroom offers. */
const guideCount = readdirSync(path.join(ROOT, "content/contracts")).filter((f) =>
  f.endsWith(".en.md"),
).length;

describe("public claims", () => {
  it("states one contract-type count, equal to the number of guides", () => {
    expect(guideCount).toBeGreaterThan(6);
    const llms = read(LLMS);
    const listed = llms.match(/^- \[[^\]]+\]\(https:\/\/dealroom\.todo\.law\/contracts\//gm) ?? [];
    expect(listed.length).toBe(guideCount);
    expect(llms).toContain(`${guideCount} contract types`);
    expect(read(LANDING_EN)).toContain(`${guideCount} contract types`);
    expect(read(LANDING_ES)).toContain(`${guideCount} tipos de contrato`);
    for (const rel of [LLMS, LANDING_EN, LANDING_ES]) {
      expect(read(rel)).not.toMatch(/\b(six|seis|32) (contract|tipos)/i);
    }
  });

  const FORBIDDEN: Array<[string, RegExp]> = [
    ["end-to-end encryption", /end-to-end encryption|encrypted (in transit and )?at rest|encrypted (workspace|negotiation|platform)/i],
    ["cifrado extremo a extremo", /cifrado extremo a extremo|plataforma (segura y )?cifrada|canales .* cifrados/i],
    ["AI decides the compromise", /AI[- ]powered compromise|AI finds|powered by AI|La IA encuentra|Compromiso con IA|— con IA/i],
    ["removed vetting page", /\/docs\/vetting/],
  ];

  it("shows no monthly price on the premium badge (there is no monthly plan)", () => {
    for (const rel of [MESSAGES_EN, MESSAGES_ES]) {
      const newDeal = (JSON.parse(read(rel)) as Record<string, Record<string, string>>).newDeal;
      expect(newDeal.premiumSkill).not.toMatch(/\{price\}|\/(mo|mes|month)/);
    }
  });
  const COPY = [LLMS, LANDING_EN, LANDING_ES, MESSAGES_EN, MESSAGES_ES, "src/config/brands/todo.ts"];

  it.each(COPY)("%s makes no claim the code cannot back", (rel) => {
    const text = read(rel);
    const hits = FORBIDDEN.filter(([, re]) => re.test(text)).map(([name]) => name);
    expect(hits).toEqual([]);
  });

  it("links only to docs pages that exist", () => {
    const docs = [...read(LLMS).matchAll(/https:\/\/dealroom\.todo\.law\/docs\/([a-z0-9-]+)/g)].map((m) => m[1]);
    expect(docs.length).toBeGreaterThan(0);
    const missing = docs.filter(
      (slug) => !existsSync(path.join(SRC, "app/(public)/docs", slug, "page.tsx")),
    );
    expect(missing).toEqual([]);
  });

  it("gives /docs/skills every string it reads, in both languages", () => {
    const page = readFileSync(path.join(SRC, "app/(public)/docs/skills/page.tsx"), "utf8");
    const ns = page.match(/useTranslations\("([^"]+)"\)/)?.[1];
    expect(ns).toBe("docsSkills");
    const keys = [...new Set([...page.matchAll(/\bt\("([^"]+)"/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThan(20);
    for (const rel of [MESSAGES_EN, MESSAGES_ES]) {
      const group = (JSON.parse(read(rel)) as Record<string, Record<string, string>>)[ns!];
      expect(keys.filter((k) => typeof group?.[k] !== "string")).toEqual([]);
    }
  });

  it("links the licence page from every footer", () => {
    for (const rel of [
      "src/app/(dashboard)/layout.tsx",
      "src/app/(public)/layout.tsx",
      "src/app/(auth)/layout.tsx",
      "src/landing/components/StartupsFooter.tsx",
      "src/components/contracts/ContractsShell.tsx",
    ]) {
      expect(read(rel)).toContain('href="/licenses"');
    }
  });
});
