// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Startup coverage, first round, with its flag on: the five tools are
 * listed on every generated surface (MCP server, server card, mcp.json,
 * /developers in both languages, developers.md, llms-full.txt), answer
 * through MCP, and go away with the flag off. explain_options reads the
 * template's own texts only.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const flags = vi.hoisted(() => ({ agentApi: true, stripeEnabled: true, startupCoverage: true }));
vi.mock("@/config/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/features")>();
  return { features: Object.assign(flags, { ...actual.features, ...flags }) };
});
vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

import { COVERAGE_TOOL_NAMES, buildMcpTools } from "@/server/services/agent/mcp-tools";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { buildDevelopersDoc, developersMarkdown } from "@/lib/developers-doc";
import { llmsFullText } from "@/lib/agent-discovery";
import { discoveryTools, mcpDiscoveryDocument, serverCardDocument } from "@/server/services/agent/discovery";
import { handlePayload } from "@/server/services/agent/mcp-protocol";
import { invokeTool } from "@/server/services/agent/mcp-invoke";
import { EXPLAIN_TEXT, explainOptions } from "@/server/services/agent/coverage";
import { GET as findTemplateGET } from "@/app/api/v1/agent/find-template/route";
import { GET as deadlinesGET } from "@/app/api/v1/agent/deadlines/route";

const BASE = "https://dealroom.test/api/v1/agent";

describe("coverage tools behind their flag", () => {
  it("are left out unless asked for", () => {
    const off = buildMcpTools({ baseUrl: BASE, stripeEnabled: true }).map((t) => t.name);
    const on = buildMcpTools({ baseUrl: BASE, stripeEnabled: true, coverage: true }).map((t) => t.name);
    for (const n of COVERAGE_TOOL_NAMES) {
      expect(off).not.toContain(n);
      expect(on).toContain(n);
    }
  });

  it("are named on every generated surface when on", () => {
    const names = discoveryTools().map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([...COVERAGE_TOOL_NAMES]));
    const card = serverCardDocument() as { tools: { name: string }[] };
    expect(card.tools.map((t) => t.name)).toEqual(names);
    expect((mcpDiscoveryDocument() as { tools: string[] }).tools).toEqual(names);
    for (const locale of ["en", "es"] as const) {
      const copy = DEVELOPERS_COPY[locale];
      const listed = copy.tools.flatMap((t) => t.name.split(/,\s*/));
      expect([...listed].sort()).toEqual([...names].sort());
      const md = developersMarkdown(buildDevelopersDoc({ locale, types: [], prices: [], billingOn: false }));
      const full = llmsFullText({ names: {}, tools: copy.tools, snippets: [] });
      for (const n of COVERAGE_TOOL_NAMES) {
        expect(md, `${locale} ${n}`).toContain(n);
        expect(full, n).toContain(n);
      }
      expect(copy.restRows.some((r) => r.path.startsWith("/api/v1/agent/find-template"))).toBe(true);
    }
  });

  it("use plain wording: no long dashes, no advice, no lawyer named", () => {
    const tools = buildMcpTools({ baseUrl: BASE, stripeEnabled: true, coverage: true }).filter((t) =>
      (COVERAGE_TOOL_NAMES as readonly string[]).includes(t.name),
    );
    const texts = [
      ...tools.map((t) => t.description),
      ...(["en", "es"] as const).flatMap((l) => DEVELOPERS_COPY[l].tools.map((t) => t.text)),
    ];
    for (const s of texts) {
      expect(s).not.toMatch(/[–—]/);
      expect(s).not.toMatch(/\byou need\b|we recommend|necesitas|te recomendamos|\busted\b/i);
    }
    expect(tools.filter((t) => t.public).map((t) => t.name).sort()).toEqual(["find_template", "get_deadlines"]);
  });

  it("answers find_template and get_deadlines through MCP without a key", async () => {
    const ctx = {
      tools: discoveryTools(),
      invoke: invokeTool,
      authorization: null,
      serverVersion: "test",
      keyHelpUrl: "https://dealroom.test/settings/api-keys",
    };
    const res = (await handlePayload(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "find_template", arguments: { query: "We received a subpoena" } } },
      ctx,
    )) as { result: { isError: boolean; structuredContent: { outsideTemplates: string[]; matches: unknown[] } } };
    expect(res.result.isError).toBe(false);
    expect(res.result.structuredContent.outsideTemplates).toEqual(["SUBPOENA"]);
    expect(res.result.structuredContent.matches).toEqual([]);

    const d = (await handlePayload(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_deadlines", arguments: { grantDate: "2026-12-15" } } },
      ctx,
    )) as { result: { structuredContent: { items: { id: string; dueDate: string | null }[] } } };
    expect(d.result.structuredContent.items.find((i) => i.id === "83B_ELECTION")!.dueDate).toBe("2027-01-14");
  });

  it("answer 404 with the flag off", async () => {
    flags.startupCoverage = false;
    try {
      expect((await findTemplateGET(new NextRequest(`${BASE}/find-template?q=nda`))).status).toBe(404);
      expect((await deadlinesGET(new NextRequest(`${BASE}/deadlines`))).status).toBe(404);
    } finally {
      flags.startupCoverage = true;
    }
  });
});

describe("explain_options", () => {
  const option = (code: string, extra: Record<string, unknown> = {}) => ({
    code,
    label: code,
    plainDescription: `${code} description`,
    prosPartyA: [`${code} good for A`],
    consPartyA: [],
    prosPartyB: [],
    consPartyB: [`${code} bad for B`],
    localizedContent: null,
    ...extra,
  });
  const db = (clauseOverrides: Record<string, unknown> = {}, options = [option("2-years"), option("5-years")]) => ({
    contractTemplate: {
      findUnique: vi.fn(async () => ({
        contractType: "NDA",
        isActive: true,
        skillPackageId: null,
        skillPackage: null,
        boilerplate: { partyLabels: { partyA: { en: "Disclosing Party", es: "Parte Divulgante" }, partyB: { en: "Receiving Party", es: "Parte Receptora" } } },
        clauses: [
          {
            clauseId: "confidentiality-duration",
            title: "Confidentiality duration",
            plainDescription: "How long?",
            legalContext: "Longer is more protective but harder to enforce.",
            localizedContent: null,
            options,
            ...clauseOverrides,
          },
        ],
      })),
    },
  });

  it("gives each option's two sides from the template, and ranks nothing", async () => {
    const r = await explainOptions(db() as never, { contractType: "NDA", clause: "confidentiality-duration", lang: "en" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body).toMatchObject({
      clauseId: "confidentiality-duration",
      tradeOffs: "Longer is more protective but harder to enforce.",
      sides: { partyA: "Disclosing Party", partyB: "Receiving Party" },
      note: EXPLAIN_TEXT.neutral.en,
    });
    const opts = r.body.options as { code: string; partyA: { pros: string[] }; partyB: { cons: string[] } }[];
    expect(opts.map((o) => o.code)).toEqual(["2-years", "5-years"]);
    expect(opts[0].partyA.pros).toEqual(["2-years good for A"]);
    expect(opts[0].partyB.cons).toEqual(["2-years bad for B"]);
    expect(JSON.stringify(r.body)).not.toMatch(/bias|recommend/i);
  });

  it("finds the clause by title too, and lists the clauses when it is unknown", async () => {
    expect((await explainOptions(db() as never, { contractType: "NDA", clause: "Confidentiality duration", lang: "en" })).ok).toBe(true);
    const r = await explainOptions(db() as never, { contractType: "NDA", clause: "nope", lang: "en" });
    expect(r).toMatchObject({ ok: false, status: 404, clauses: [{ clauseId: "confidentiality-duration" }] });
  });

  it("says so when the template has no explanation text", async () => {
    const bare = option("only", { plainDescription: "", prosPartyA: [], consPartyB: [] });
    const r = await explainOptions(db({ legalContext: null }, [bare]) as never, { contractType: "NDA", clause: "confidentiality-duration", lang: "es" });
    expect(r.ok && r.body.note).toBe(EXPLAIN_TEXT.noText.es);
    expect(r.ok && (r.body.options as { note?: string }[])[0].note).toBe(EXPLAIN_TEXT.optionNoText.es);
  });
});
