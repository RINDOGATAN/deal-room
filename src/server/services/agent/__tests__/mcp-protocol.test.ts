// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The MCP server: the JSON-RPC methods a client uses to connect, list and
 * call tools, and how REST answers become tool results.
 */
import { describe, expect, it, vi } from "vitest";
import { buildMcpTools } from "@/server/services/agent/mcp-tools";
import {
  LATEST_PROTOCOL_VERSION,
  RPC,
  handleMessage,
  handlePayload,
  type McpContext,
} from "@/server/services/agent/mcp-protocol";

const tools = buildMcpTools({ baseUrl: "https://dealroom.test/api/v1/agent", contractTypes: ["NDA"], stripeEnabled: true });

function ctx(over: Partial<McpContext> = {}): McpContext {
  return {
    tools,
    invoke: vi.fn(async () => Response.json({ ok: true }, { status: 201 })),
    authorization: "Bearer drk_test",
    serverVersion: "9.9.9",
    keyHelpUrl: "https://dealroom.test/settings/api-keys",
    ...over,
  };
}

const call = (name: string, args: Record<string, unknown> = {}, id = 7) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: args },
});

describe("MCP protocol", () => {
  it("initializes with the client's protocol version when supported", async () => {
    const res = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
      ctx(),
    );
    expect(res?.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "dealroom", version: "9.9.9" },
    });
  });

  it("offers its latest version for an unknown one", async () => {
    const res = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } },
      ctx(),
    );
    expect((res?.result as { protocolVersion: string }).protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("lists the one-call tools with their input schemas", async () => {
    const res = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx());
    const listed = (res?.result as { tools: { name: string; inputSchema: { required: string[] } }[] }).tools;
    const names = listed.map((t) => t.name);
    expect(names.slice(0, 2)).toEqual(["list_contract_types", "generate_contract"]);
    expect(names).toContain("download_contract");
    expect(listed.find((t) => t.name === "generate_contract")?.inputSchema.required).toEqual(["contractType", "party"]);
  });

  it("works without a key for connecting, listing and the public tool", async () => {
    const c = ctx({ authorization: null });
    expect((await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, c))?.result).toBeTruthy();
    expect((await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, c))?.result).toBeTruthy();
    const listed = await handleMessage(call("list_contract_types"), c);
    expect((listed?.result as { isError: boolean }).isError).toBe(false);
    expect(c.invoke).toHaveBeenCalledTimes(1);
  });

  it("answers a keyless call to a paid tool with a tool error naming where to get a key", async () => {
    const c = ctx({ authorization: null });
    const res = await handleMessage(call("generate_contract", { contractType: "NDA" }), c);
    const result = res?.result as { isError: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("https://dealroom.test/settings/api-keys");
    expect(c.invoke).not.toHaveBeenCalled();
  });

  it("runs a tool through its REST route and returns the JSON", async () => {
    const c = ctx();
    const res = await handleMessage(call("generate_contract", { contractType: "NDA", party: { legalName: "A" } }), c);
    expect(c.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ name: "generate_contract" }),
      { contractType: "NDA", party: { legalName: "A" } },
      "Bearer drk_test",
    );
    expect(res?.result).toMatchObject({ isError: false, structuredContent: { ok: true } });
  });

  it("turns a 402 into a tool error the agent can read", async () => {
    const c = ctx({
      invoke: vi.fn(async () => Response.json({ code: "PAYMENT_REQUIRED" }, { status: 402 })),
    });
    const res = await handleMessage(call("generate_contract", { contractType: "NDA" }), c);
    const result = res?.result as { isError: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HTTP 402");
    expect(result.content[0].text).toContain("PAYMENT_REQUIRED");
  });

  it("returns a PDF as an embedded resource", async () => {
    const pdf = Buffer.from("%PDF-1.4 test");
    const c = ctx({
      invoke: vi.fn(
        async () =>
          new Response(pdf, {
            headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="nda_contract.pdf"' },
          }),
      ),
    });
    const res = await handleMessage(call("download_contract", { dealId: "adr_1" }), c);
    const content = (res?.result as { content: { type: string; resource?: { mimeType: string; blob: string } }[] }).content;
    const resource = content.find((x) => x.type === "resource")?.resource;
    expect(resource?.mimeType).toBe("application/pdf");
    expect(Buffer.from(resource!.blob, "base64").toString()).toBe("%PDF-1.4 test");
  });

  it("rejects an unknown tool and an unknown method", async () => {
    expect((await handleMessage(call("delete_everything"), ctx()))?.error?.code).toBe(RPC.INVALID_PARAMS);
    expect((await handleMessage({ jsonrpc: "2.0", id: 3, method: "resources/list" }, ctx()))?.error?.code).toBe(
      RPC.METHOD_NOT_FOUND,
    );
    expect((await handleMessage({ id: 3, method: "ping" }, ctx()))?.error?.code).toBe(RPC.INVALID_REQUEST);
  });

  it("answers ping, ignores notifications and handles a batch", async () => {
    expect((await handleMessage({ jsonrpc: "2.0", id: 4, method: "ping" }, ctx()))?.result).toEqual({});
    expect(await handlePayload({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx())).toBeNull();
    const batch = (await handlePayload(
      [
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 5, method: "ping" },
      ],
      ctx(),
    )) as { id: number }[];
    expect(batch).toHaveLength(1);
    expect(batch[0].id).toBe(5);
  });
});
