// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent discovery (owner, 6 October 2026): every guide's agent block, the
 * MCP server card, /.well-known/mcp.json, the agent card, /llms-full.txt
 * and the ranked list on /developers come from one source, carry every
 * contract code and use absolute addresses only.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { contractTemplate: { findMany: vi.fn(async () => []) } },
  prisma: { contractTemplate: { findMany: vi.fn(async () => []) } },
}));
vi.mock("@/server/services/billing/pricing", () => ({ agentPricingBlock: vi.fn(async () => ({})) }));

import { CONTRACT_PAGES, PAGE_LOCALES, SITE_URL, contractPath } from "@/lib/contract-pages-paths";
import {
  COMMON_CONTRACTS,
  MCP_SERVER_VERSION,
  MCP_URL,
  ONE_CALL_URL,
  agentBlockPath,
  agentContractType,
  allContractCodes,
  contractAgentJsonLd,
  exampleLaw,
  mustSendInputs,
  oneCallBody,
  oneCallCurl,
} from "@/lib/agent-discovery";
import { CONTRACT_COPY } from "@/components/contracts/copy";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { agentRows, buildDevelopersDoc, developersMarkdown } from "@/lib/developers-doc";
import { generateContractSchema } from "@/server/services/agent/generateContract";
import { GET as serverCardGet } from "@/app/.well-known/mcp/server-card.json/route";
import { GET as mcpJsonGet } from "@/app/.well-known/mcp.json/route";
import { GET as llmsFullGet } from "@/app/llms-full.txt/route";
import { GET as agentCardGet } from "@/app/.well-known/agent.json/route";

const ROOT = process.cwd();
const codes = CONTRACT_PAGES.map((p) => p.contractType);

/** Every string in a JSON value, with the key it sits under. */
function entries(value: unknown, key = ""): Array<[string, string]> {
  if (typeof value === "string") return [[key, value]];
  if (Array.isArray(value)) return value.flatMap((v) => entries(v, key));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => entries(v, k));
  }
  return [];
}

/** URLs must be absolute: any value under a url-like key, and any string that looks like a path to a file of ours. */
function expectAbsoluteUrls(doc: unknown) {
  for (const [key, value] of entries(doc)) {
    if (/(url|Url|endpoint|setup|serverCard|guide|agentExample|list|llms|llmsFull|agentCard|developers|developersMarkdown|documentation|keyCreationUrl)$/.test(key)) {
      expect(value, `${key}: ${value}`).toMatch(/^https:\/\//);
    }
    if (/^\/(api|contracts|es|developers|\.well-known|llms)/.test(value)) {
      throw new Error(`relative address under ${key}: ${value}`);
    }
  }
}

describe("the contract-types source", () => {
  it("has an entry for every guide, and none without one", () => {
    const snap = CONTRACT_PAGES.map((p) => agentContractType(p.contractType));
    expect(snap.every(Boolean)).toBe(true);
    for (const p of CONTRACT_PAGES) expect(agentContractType(p.contractType)!.slug).toBe(p.slug);
    const file = JSON.parse(readFileSync(join(ROOT, "src/lib/agent-contract-types.json"), "utf8"));
    expect(file.contractTypes.map((t: { contractType: string }) => t.contractType).sort()).toEqual([...codes].sort());
  });

  it("matches the required inputs of the built-in skills of this repository", () => {
    for (const base of ["skills", "prisma/hosted-skills"]) {
      for (const dir of readdirSync(join(ROOT, base), { withFileTypes: true }).filter((d) => d.isDirectory())) {
        const meta = join(ROOT, base, dir.name, "metadata.json");
        const params = join(ROOT, base, dir.name, "parameters.json");
        if (!existsSync(meta) || !existsSync(params)) continue;
        const { contractType } = JSON.parse(readFileSync(meta, "utf8"));
        const schema = JSON.parse(readFileSync(params, "utf8"));
        const required = (schema.parameters ?? []).filter((p: { required?: boolean }) => p.required);
        const snap = agentContractType(contractType);
        expect(snap, contractType).toBeDefined();
        expect(snap!.requiredInputs.map((i) => i.id), contractType).toEqual(required.map((p: { id: string }) => p.id));
        for (const p of required) {
          const s = snap!.requiredInputs.find((i) => i.id === p.id)!;
          expect(s.default, `${contractType}.${p.id}`).toBe(p.default === "" ? undefined : p.default);
        }
      }
    }
  });

  it("ranks the common contracts first, then every other guide once", () => {
    const all = allContractCodes();
    expect(all.slice(0, COMMON_CONTRACTS.length)).toEqual([...COMMON_CONTRACTS]);
    expect([...all].sort()).toEqual([...codes].sort());
  });
});

describe("the agent block of each guide", () => {
  it.each(CONTRACT_PAGES.map((p) => [p.contractType, p] as const))("%s: one call the API accepts", (code, p) => {
    const t = agentContractType(code)!;
    for (const locale of PAGE_LOCALES) {
      const body = oneCallBody(code, locale);
      expect(generateContractSchema.safeParse(body).success).toBe(true);
      expect(body.contractType).toBe(code);
      // A governing law is sent only where the type offers more than one, and is one it offers.
      if (t.governingLaws.length > 1) expect(t.governingLaws).toContain(body.governingLaw);
      else expect(body.governingLaw).toBeUndefined();
      expect(t.languages).toContain(body.language);
      // Every input that must be sent under that law is in terms.
      const law = (body.governingLaw as string | undefined) ?? t.governingLaws[0];
      const terms = (body.terms ?? {}) as Record<string, string>;
      for (const i of mustSendInputs(t, law)) expect(terms[i.id], i.id).toBeTruthy();
      const curl = oneCallCurl(code, locale);
      expect(curl).toContain(`curl -X POST ${ONE_CALL_URL}`);
      expect(curl).toContain(`"contractType": "${code}"`);
      expect(curl).not.toMatch(/[–—]/);
    }
    expect(agentBlockPath("es", p.slug)).toBe(`/es/contracts/${p.slug}#agent`);
  });

  it("sends the governing law the page prefers", () => {
    expect(exampleLaw(agentContractType("NDA"), "es")).toBe("SPAIN");
    expect(exampleLaw(agentContractType("NDA"), "en")).toBe("ENGLAND_WALES");
    // Delaware runs under California only: nothing to send.
    expect(exampleLaw(agentContractType("DELAWARE_CERT_OF_INCORPORATION"), "en")).toBeNull();
    expect(oneCallBody("DPA", "en").terms).toEqual({
      "processing-purpose": "<processing-purpose>",
      "data-categories": "contact-details",
    });
  });

  it("adds a WebAPI node that points at the one call and names the contract code", () => {
    const node = contractAgentJsonLd({
      locale: "en",
      slug: "nda",
      code: "NDA",
      name: "NDA",
      apiName: "Dealroom agent API",
      actionName: "Make this contract in one call",
    }) as {
      "@type": string;
      "@id": string;
      subjectOf: { "@id": string };
      potentialAction: {
        target: { urlTemplate: string; httpMethod: string };
        object: { identifier: string };
        instrument: { url: string };
      };
    };
    expect(node["@type"]).toBe("WebAPI");
    expect(node["@id"]).toBe(`${SITE_URL}/contracts/nda#agent`);
    expect(node.subjectOf["@id"]).toBe(`${SITE_URL}/contracts/nda#article`);
    expect(node.potentialAction.target.urlTemplate).toBe(ONE_CALL_URL);
    expect(node.potentialAction.target.httpMethod).toBe("POST");
    expect(node.potentialAction.object.identifier).toBe("NDA");
    expect(node.potentialAction.instrument.url).toBe(MCP_URL);
    expectAbsoluteUrls(node);
  });

  it("has wording with no long dashes, and the Spanish says tú", () => {
    const keys = ["agentTitle", "agentText", "agentCode", "agentInputs", "agentServer", "agentCallLabel", "agentSetup"] as const;
    for (const locale of PAGE_LOCALES) {
      for (const k of keys) expect(CONTRACT_COPY[locale][k]).not.toMatch(/[–—]/);
    }
    for (const k of keys) expect(CONTRACT_COPY.es[k]).not.toMatch(/\busted(es)?\b/i);
    expect(CONTRACT_COPY.es.agentText).toMatch(/\btu\b/);
  });
});

describe("discovery files", () => {
  it("serves the MCP server card: valid JSON, every code, absolute URLs", async () => {
    const res = serverCardGet();
    const card = JSON.parse(await res.text());
    expect(card.transport).toEqual({ type: "streamable-http", endpoint: MCP_URL });
    expect(card.serverInfo.version).toBe(MCP_SERVER_VERSION);
    expect(card.authentication.required).toBe(true);
    expect(card.authentication.header).toBe("Authorization");
    const toolNames = card.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toEqual(expect.arrayContaining(["generate_contract", "list_contract_types", "download_contract"]));
    for (const t of card.tools) expect(t.inputSchema.type).toBe("object");
    expect([...card.contractTypes.codes].sort()).toEqual([...codes].sort());
    expectAbsoluteUrls(card);
  });

  it("serves /.well-known/mcp.json: valid JSON, every code with its guide, absolute URLs", async () => {
    const doc = JSON.parse(await mcpJsonGet().text());
    expect(doc.mcpServers.dealroom.url).toBe(MCP_URL);
    expect(doc.mcpServers.dealroom.transport).toBe("streamable-http");
    expect(doc.serverCard).toBe(`${SITE_URL}/.well-known/mcp/server-card.json`);
    const items = doc.contractTypes.items as { contractType: string; guide: string; agentExample: string }[];
    expect(items.map((i) => i.contractType).sort()).toEqual([...codes].sort());
    for (const p of CONTRACT_PAGES) {
      const item = items.find((i) => i.contractType === p.contractType)!;
      expect(item.guide).toBe(`${SITE_URL}${contractPath("en", p.slug)}`);
      expect(item.agentExample).toBe(`${SITE_URL}${contractPath("en", p.slug)}#agent`);
    }
    expectAbsoluteUrls(doc);
  });

  it("lists the one-call and contract-types skills with every code on the agent card", async () => {
    const card = JSON.parse(await (await agentCardGet()).text());
    const oneCall = card.skills.find((s: { id: string }) => s.id === "generate-contract");
    const list = card.skills.find((s: { id: string }) => s.id === "list-contract-types");
    expect(oneCall.endpoint.url).toBe(ONE_CALL_URL);
    expect(list.endpoint.url).toBe(`${SITE_URL}/api/v1/agent/contract-types`);
    for (const skill of [oneCall, list]) {
      expect([...skill.contractTypes].sort()).toEqual([...codes].sort());
      for (const code of codes) expect(skill.tags).toContain(code);
    }
    for (const ex of oneCall.examples) expect(() => JSON.parse(ex)).not.toThrow();
    expect(card.endpoints.mcpServerCard).toBe(`${SITE_URL}/.well-known/mcp/server-card.json`);
    expect(card.endpoints.llmsFull).toBe(`${SITE_URL}/llms-full.txt`);
  });

  it("serves /llms-full.txt with every code, its required inputs and both guide links", async () => {
    const res = llmsFullGet();
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain(MCP_URL);
    expect(text).toContain(`POST ${ONE_CALL_URL}`);
    expect(text).toContain(`${SITE_URL}/.well-known/mcp/server-card.json`);
    expect(text).toContain(`## Contract types (${CONTRACT_PAGES.length})`);
    for (const p of CONTRACT_PAGES) {
      expect(text, p.contractType).toContain(`(\`${p.contractType}\`)`);
      expect(text).toContain(`${SITE_URL}${contractPath("en", p.slug)}`);
      expect(text).toContain(`${SITE_URL}${contractPath("es", p.slug)}`);
      for (const i of agentContractType(p.contractType)!.requiredInputs) expect(text).toContain(`\`${i.id}\``);
    }
    // The common contracts come first.
    expect(text.indexOf("(`NDA`)")).toBeLessThan(text.indexOf("(`DPA`)"));
    expect(text.indexOf("(`PRIVACY_NOTICE`)")).toBeLessThan(text.indexOf("(`JOINT_VENTURE`)"));
    // Every JSON body parses and every address is absolute.
    for (const m of text.matchAll(/```json\n([\s\S]*?)\n```/g)) expect(() => JSON.parse(m[1])).not.toThrow();
    expect(text).not.toMatch(/\]\(\//);
    expect(text).not.toMatch(/[–—]/);
  });

  it("links the new files from llms.txt and allows them in robots.txt", () => {
    const llms = readFileSync(join(ROOT, "public/llms.txt"), "utf8");
    expect(llms).toContain(`${SITE_URL}/llms-full.txt`);
    expect(llms).toContain(`${SITE_URL}/.well-known/mcp/server-card.json`);
    expect(llms).toContain(`${SITE_URL}/.well-known/mcp.json`);
    const robots = readFileSync(join(ROOT, "public/robots.txt"), "utf8");
    for (const path of ["/.well-known/", "/llms.txt", "/llms-full.txt", "/developers.md", "/api/v1/agent/contract-types"]) {
      expect(robots).toContain(`Allow: ${path}`);
    }
  });

  it("keeps server.json, the MCP route and the card on one version", () => {
    const server = JSON.parse(readFileSync(join(ROOT, "server.json"), "utf8"));
    expect(MCP_SERVER_VERSION).toBe(server.version);
  });
});

describe("Contracts for AI agents on /developers", () => {
  it("ranks the common contracts, each with its code and a link to its one call", () => {
    for (const locale of PAGE_LOCALES) {
      const rows = agentRows(locale);
      expect(rows.map((r) => r.code)).toEqual([...COMMON_CONTRACTS]);
      for (const r of rows) {
        const page = CONTRACT_PAGES.find((p) => p.contractType === r.code)!;
        expect(r.callHref).toBe(`${contractPath(locale, page.slug)}#agent`);
        expect(r.name).not.toBe(r.code);
      }
    }
    const md = developersMarkdown(buildDevelopersDoc({ locale: "en", types: [], prices: [], billingOn: false }));
    expect(md).toContain("## Contracts for AI agents");
    expect(md).toContain(
      "| 1 | [Non-disclosure agreement (NDA)](https://dealroom.todo.law/contracts/nda) | `NDA` | `dispute-forum-city (only under Spain; if left out, the default Madrid is applied)` | [See the call](https://dealroom.todo.law/contracts/nda#agent) |",
    );
    expect(md).toContain("`processing-purpose`, `data-categories`");
  });

  it("has wording with no long dashes, and the Spanish never says usted", () => {
    for (const locale of PAGE_LOCALES) {
      const c = DEVELOPERS_COPY[locale];
      for (const text of [c.agentsIntro, c.agentsCaption, c.agentsCallLink, ...Object.values(c.commonNames), ...Object.values(c.agentsColumns)]) {
        expect(text).not.toMatch(/[–—]/);
        if (locale === "es") expect(text).not.toMatch(/\busted(es)?\b/i);
      }
    }
  });
});
