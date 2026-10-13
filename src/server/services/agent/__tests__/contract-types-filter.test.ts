// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * list_contract_types with its optional filter: one type with its inputs,
 * a summary without inputs, an unknown type, and the full list by default.
 * Through the REST route and through the MCP tool, without a key.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/config/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/features")>();
  return { features: { ...actual.features, agentApi: true } };
});
vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

const input = { id: "x", label: "X", type: "text", required: true, mustSend: true };
const catalogue = [
  { contractType: "NDA", name: "NDA", inputs: [input] },
  { contractType: "DPA", name: "DPA", inputs: [input, input] },
];
vi.mock("@/server/services/agent/contractTypes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/agent/contractTypes")>();
  return { ...actual, listContractTypes: vi.fn(async () => catalogue) };
});

import { GET } from "@/app/api/v1/agent/contract-types/route";
import { invokeTool } from "@/server/services/agent/mcp-invoke";
import { buildMcpTools } from "@/server/services/agent/mcp-tools";

const get = (qs: string) => GET(new NextRequest(`https://dealroom.test/api/v1/agent/contract-types${qs}`));
const tool = buildMcpTools({ baseUrl: "https://dealroom.test/api/v1/agent", stripeEnabled: true }).find(
  (t) => t.name === "list_contract_types",
)!;

describe("list_contract_types filter", () => {
  it("keeps the full list by default", async () => {
    const body = await (await get("")).json();
    expect(body.contractTypes.map((t: { contractType: string }) => t.contractType)).toEqual(["NDA", "DPA"]);
    expect(body.contractTypes[1].inputs).toHaveLength(2);
  });

  it("returns one type with its inputs, by code or slug", async () => {
    for (const qs of ["?contractType=DPA", "?contractType=data-processing-agreement&lang=es"]) {
      const body = await (await get(qs)).json();
      expect(body.contractTypes).toEqual([catalogue[1]]);
    }
  });

  it("returns a summary without inputs", async () => {
    const body = await (await get("?summary=1")).json();
    expect(body.contractTypes).toEqual([
      { contractType: "NDA", name: "NDA", inputCount: 1 },
      { contractType: "DPA", name: "DPA", inputCount: 2 },
    ]);
  });

  it("answers 404 for an unknown type", async () => {
    const res = await get("?contractType=LEASE");
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("is declared on the tool and passed through MCP without a key", async () => {
    expect(Object.keys((tool.inputSchema as { properties: object }).properties)).toEqual(["lang", "contractType", "summary"]);
    expect(tool.public).toBe(true);
    const one = await (await invokeTool(tool, { contractType: "dpa" }, null)).json();
    expect(one.contractTypes).toEqual([catalogue[1]]);
    const short = await (await invokeTool(tool, { summary: true }, null)).json();
    expect(short.contractTypes[0]).toEqual({ contractType: "NDA", name: "NDA", inputCount: 1 });
    const all = await (await invokeTool(tool, {}, null)).json();
    expect(all.contractTypes).toHaveLength(2);
  });
});
