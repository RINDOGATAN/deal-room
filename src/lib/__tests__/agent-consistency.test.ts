// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The agent surfaces agree with each other (live sweep, 6 October 2026):
 * required inputs follow one rule everywhere, the placeholder template is
 * never offered, the contract lists are one list, the agent card does not
 * claim the A2A protocol, the price says when the one call is charged,
 * robots.txt keeps the private paths closed to the named AI crawlers and
 * every live MCP tool is named in the docs.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const templates = vi.hoisted(() => [
  { contractType: "NDA", displayName: "Non-Disclosure Agreement", jurisdictions: ["CALIFORNIA"], languages: ["en"], skillPackage: null },
  { contractType: "TEMPLATE", displayName: "Template Agreement", jurisdictions: ["CALIFORNIA"], languages: ["en"], skillPackage: null },
  { contractType: "A2A_TOOL_LICENSE", displayName: "Tool License Agreement", jurisdictions: ["CALIFORNIA"], languages: ["en"], skillPackage: { isPremium: true } },
]);
const findMany = vi.hoisted(() =>
  vi.fn(async (args: { where?: { NOT?: { contractType?: string } } }) =>
    templates.filter((t) => t.contractType !== args?.where?.NOT?.contractType),
  ),
);
vi.mock("@/lib/prisma", () => ({
  default: { contractTemplate: { findMany } },
  prisma: { contractTemplate: { findMany } },
}));
vi.mock("@/config/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/features")>();
  return { features: { ...actual.features, agentApi: true, stripeEnabled: true } };
});
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ prices: { retrieve: vi.fn(async () => ({ unit_amount: 2900, currency: "usd" })) } }),
}));

import { CONTRACT_PAGES } from "@/lib/contract-pages-paths";
import { MCP_URL, agentContractType, allContractCodes, llmsFullText, mcpDiscovery } from "@/lib/agent-discovery";
import { describeInput, inputDefault, mustSend, requiredInputs } from "@/lib/agent-inputs";
import { agentRows, developersMarkdown, buildDevelopersDoc } from "@/lib/developers-doc";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { OFFERED_GOVERNING_LAWS, buildMcpTools } from "@/server/services/agent/mcp-tools";
import { inputsFor } from "@/server/services/agent/contractTypes";
import { serverCardDocument } from "@/server/services/agent/discovery";
import { agentPricingBlock } from "@/server/services/billing/pricing";
import { unauthorizedResponse } from "@/server/middleware/unauthorized";
import { GET as agentCardGet } from "@/app/.well-known/agent.json/route";

const ROOT = process.cwd();

/** Required inputs with a default, by contract type, as the sweep found them. */
const DEFAULTED = [
  ["NDA", "dispute-forum-city"],
  ["DATA_LICENSING", "license-term"],
  ["DPA", "processor-establishment"],
  ["CONSULTING", "rate-currency"],
  ["EMPLOYMENT", "salary-currency"],
  ["CONTRATO_SERVICIOS", "plazo-pago-dias"],
] as const;

describe("required inputs: one rule everywhere", () => {
  it("lists a required input with a default as required, with its default", () => {
    const i = { id: "dispute-forum-city", default: "Madrid", onlyUnder: ["SPAIN"] };
    expect(mustSend(i)).toBe(false);
    expect(requiredInputs([i])).toEqual([i]);
    expect(requiredInputs([i], "CALIFORNIA")).toEqual([]);
    expect(describeInput(i, "en")).toBe("dispute-forum-city (only under SPAIN; if left out, the default Madrid is applied)");
    expect(describeInput(i, "es")).toBe("dispute-forum-city (solo con SPAIN; si no lo envías, se aplica el valor por defecto Madrid)");
    expect(inputDefault({ id: "x", default: "" })).toBeUndefined();
    expect(mustSend({ id: "x", default: "" })).toBe(true);
    expect(requiredInputs([{ id: "y", required: false }])).toEqual([]);
  });

  it("shows each defaulted input on the guides' rows, mcp.json, llms-full.txt and the API", () => {
    const discovery = mcpDiscovery({ toolNames: [] }) as {
      contractTypes: { items: { contractType: string; requiredInputs: string[]; defaultsIfLeftOut?: Record<string, string> }[] };
    };
    const full = llmsFullText({ names: {}, tools: [], snippets: [] });
    for (const [code, id] of DEFAULTED) {
      const t = agentContractType(code);
      expect(t, code).toBeTruthy();
      const input = t!.requiredInputs.find((i) => i.id === id);
      expect(input, `${code} ${id}`).toBeTruthy();
      const value = inputDefault(input!)!;
      expect(value, `${code} ${id} default`).toBeTruthy();

      // mcp.json: listed as required, with the default applied if left out.
      const item = discovery.contractTypes.items.find((x) => x.contractType === code)!;
      expect(item.requiredInputs).toContain(id);
      expect(item.defaultsIfLeftOut?.[id]).toBe(value);

      // llms-full.txt: the same input with the same default wording.
      expect(full).toContain(`\`${id}\``);
      expect(full).toContain(`if left out, the default ${value} is applied`);

      // The API marks it required, with its default, and mustSend false.
      const [api] = inputsFor({ version: "1.0", parameters: [{ id, token: "t", scope: "s", type: "text", required: true, default: value, label: id }] } as never, "en");
      expect(api).toMatchObject({ required: true, default: value, mustSend: false });
    }
    // The ranked rows on /developers (the same source as the guides' agent block).
    const nda = agentRows("en").find((r) => r.code === "NDA")!;
    expect(nda.inputs).toEqual(["dispute-forum-city (only under Spain; if left out, the default Madrid is applied)"]);
  });
});

describe("one list of contract types", () => {
  const tools = buildMcpTools({ baseUrl: "https://dealroom.test/api/v1/agent", stripeEnabled: true });
  const tool = (name: string) => tools.find((t) => t.name === name)!;
  const props = (name: string) => (tool(name).inputSchema as { properties: Record<string, { enum?: string[] }> }).properties;

  it("holds no code list of its own in any tool, so live tools and the card agree", () => {
    for (const name of ["get_template", "create_playbook", "generate_contract"]) {
      expect(props(name).contractType.enum, name).toBeUndefined();
    }
    expect(JSON.stringify(tools)).not.toContain('"TEMPLATE"');
    const card = serverCardDocument() as { tools: { name: string; inputSchema: unknown }[]; contractTypes: { codes: string[] } };
    expect(card.tools.map((t) => t.name)).toEqual(tools.map((t) => t.name));
    expect(card.contractTypes.codes).toEqual(allContractCodes());
    expect(card.contractTypes.codes).not.toContain("TEMPLATE");
  });

  it("offers only governing laws some contract type offers (no New York)", () => {
    expect(props("generate_contract").governingLaw.enum).toEqual(OFFERED_GOVERNING_LAWS);
    expect(props("create_playbook").governingLaw.enum).toEqual(OFFERED_GOVERNING_LAWS);
    expect(OFFERED_GOVERNING_LAWS).not.toContain("NEW_YORK");
    for (const p of CONTRACT_PAGES) {
      for (const law of agentContractType(p.contractType)?.governingLaws ?? []) {
        expect(OFFERED_GOVERNING_LAWS, p.contractType).toContain(law);
      }
    }
  });
});

describe("the agent card", () => {
  it("points at the MCP endpoint, says it is not A2A, and leaves the placeholder out", async () => {
    const card = JSON.parse(await (await agentCardGet()).text());
    expect(card.url).toBe(MCP_URL);
    expect(card.a2a.supported).toBe(false);
    expect(card.preferredTransport).toBeUndefined();
    expect(card.protocolVersion).toBeUndefined();
    expect(card.interfaces[0]).toMatchObject({ protocol: "mcp", transport: "streamable-http", url: MCP_URL });
    const listed = card.supportedContractTypes.map((t: { contractType: string }) => t.contractType);
    expect(listed).toEqual(["NDA"]);
    expect(listed.every((c: string) => allContractCodes().includes(c))).toBe(true);
    expect(card.a2aProtocolTypes.map((t: { contractType: string }) => t.contractType)).toEqual(["A2A_TOOL_LICENSE"]);
    expect(JSON.stringify(card)).not.toContain('"TEMPLATE"');
  });

  it("says that a contract made in one call spends its credit when it is made", async () => {
    const pricing = (await agentPricingBlock()) as { chargedWhen: string };
    expect(pricing.chargedWhen).toContain("generate_contract");
    expect(pricing.chargedWhen).toContain("when it is made");
    expect(pricing.chargedWhen).not.toMatch(/[–—]/);
  });
});

describe("REST 401", () => {
  it("sends the Bearer challenge and where to create a key", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toMatch(/^Bearer\b/);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toContain("/settings/api-keys");
  });

  it("is used by every /api/v1 route that checks a key", () => {
    const dir = join(ROOT, "src/app/api/v1");
    const files = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith("route.ts"));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/error: "Unauthorized" \}, \{ status: 401/);
      if (src.includes("authenticateApiKey(")) expect(src, f).toContain("unauthorizedResponse()");
    }
  });
});

describe("robots.txt", () => {
  it("keeps the private paths closed to the named AI crawlers too", () => {
    const robots = readFileSync(join(ROOT, "public/robots.txt"), "utf8");
    const groups = robots.split(/\n\s*\n/).map((g) => g.split("\n").filter((l) => l && !l.startsWith("#")));
    const star = groups.find((g) => g.includes("User-agent: *"))!;
    const disallows = star.filter((l) => l.startsWith("Disallow:"));
    expect(disallows).toEqual(expect.arrayContaining(["Disallow: /api/", "Disallow: /deals/", "Disallow: /account/", "Disallow: /auth/"]));
    for (const g of groups) {
      if (g.includes("User-agent: *") || !g.some((l) => l.startsWith("User-agent:"))) continue;
      if (g.includes("Disallow: /")) continue; // a crawler shut out entirely
      for (const d of disallows) expect(g, g[0]).toContain(d);
    }
    expect(robots).toContain("User-agent: ClaudeBot");
  });
});

describe("every live MCP tool is named in the docs", () => {
  const names = buildMcpTools({ baseUrl: "https://dealroom.test/api/v1/agent", stripeEnabled: true }).map((t) => t.name);

  it("in llms.txt, llms-full.txt, /developers (both languages) and developers.md", () => {
    const llms = readFileSync(join(ROOT, "public/llms.txt"), "utf8");
    expect(llms).not.toContain("plus the negotiation tools");
    for (const locale of ["en", "es"] as const) {
      const copy = DEVELOPERS_COPY[locale];
      const listed = copy.tools.flatMap((t) => t.name.split(/,\s*/));
      const md = developersMarkdown(buildDevelopersDoc({ locale, types: [], prices: [], billingOn: false }));
      const full = llmsFullText({ names: {}, tools: copy.tools, snippets: [] });
      for (const n of names) {
        expect(llms, `llms.txt ${n}`).toContain(`\`${n}\``);
        expect(listed, `/developers ${locale} ${n}`).toContain(n);
        expect(md, `developers.md ${locale} ${n}`).toContain(n);
        expect(full, `llms-full.txt ${n}`).toContain(n);
      }
      expect(listed.sort()).toEqual([...names].sort());
    }
  });
});
