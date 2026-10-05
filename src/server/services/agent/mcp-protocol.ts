// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The MCP server of the agent API, over Streamable HTTP without sessions:
 * every POST to /api/v1/agent/mcp carries JSON-RPC and gets a JSON answer
 * (no event stream, no server-initiated messages). Methods: `initialize`,
 * `ping`, `tools/list`, `tools/call`; notifications are accepted and
 * answered 202.
 *
 * Authentication is the agent API key in the Authorization header, the
 * same header every REST route reads. Connecting and listing tools work
 * without it; a tool that needs a key answers with a tool error naming
 * where to get one. `tools/call` runs the tool's REST route (see
 * `mcp-invoke.ts`), so prices, credits and limits are the REST ones.
 */

import type { McpToolDef } from "./mcp-tools";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export type ToolInvoker = (
  tool: McpToolDef,
  args: Record<string, unknown>,
  authorization: string | null,
) => Promise<Response>;

export interface McpContext {
  tools: McpToolDef[];
  invoke: ToolInvoker;
  authorization: string | null;
  serverVersion: string;
  keyHelpUrl: string;
}

type JsonRpcId = string | number;
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export function rpcError(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

const INSTRUCTIONS =
  "Dealroom drafts and negotiates contracts. To make a contract, call list_contract_types to see what each type needs, then generate_contract with the type, your side's details and the required inputs. With billing on, each contract spends one prepaid credit (buy_credits); drafting and negotiating are free.";

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function hasKey(authorization: string | null): boolean {
  return !!authorization && /^Bearer\s+drk_/.test(authorization);
}

/** A REST answer as an MCP tool result. */
export async function toolResult(res: Response, tool: McpToolDef): Promise<Record<string, unknown>> {
  const type = (res.headers.get("Content-Type") || "").toLowerCase();
  const isError = !res.ok;

  if (type.includes("application/json")) {
    const raw = await res.text();
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // keep the raw text
    }
    const text = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
    return {
      content: [{ type: "text", text: isError ? `HTTP ${res.status}: ${text}` : text }],
      ...(isObject(parsed) && !isError ? { structuredContent: parsed } : {}),
      isError,
    };
  }
  if (type.startsWith("text/")) {
    return { content: [{ type: "text", text: await res.text() }], isError };
  }

  // A document (PDF, DOCX): returned as an embedded resource.
  const bytes = Buffer.from(await res.arrayBuffer());
  const disposition = res.headers.get("Content-Disposition") || "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${tool.name}.bin`;
  return {
    content: [
      { type: "text", text: `${filename} (${bytes.length} bytes)` },
      {
        type: "resource",
        resource: {
          uri: `dealroom://documents/${encodeURIComponent(filename)}`,
          mimeType: type.split(";")[0] || "application/octet-stream",
          blob: bytes.toString("base64"),
        },
      },
    ],
    isError,
  };
}

/** One JSON-RPC message. Null for a notification or a client response (no answer). */
export async function handleMessage(msg: unknown, ctx: McpContext): Promise<JsonRpcResponse | null> {
  if (!isObject(msg) || msg.jsonrpc !== "2.0") {
    return rpcError(null, RPC.INVALID_REQUEST, "Not a JSON-RPC 2.0 message");
  }
  const hasId = typeof msg.id === "string" || typeof msg.id === "number";
  if (typeof msg.method !== "string") {
    // A response to a server request: this server sends none, so ignore it.
    return hasId || "result" in msg || "error" in msg ? null : rpcError(null, RPC.INVALID_REQUEST, "No method");
  }
  if (!hasId) return null; // notification (initialized, cancelled, ...)
  const id = msg.id as JsonRpcId;
  const params = isObject(msg.params) ? msg.params : {};

  switch (msg.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(asked) ? asked : LATEST_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "dealroom", title: "Dealroom", version: ctx.serverVersion },
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: ctx.tools.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: { title: t.title, readOnlyHint: !!t.readOnly, openWorldHint: false },
          })),
        },
      };
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const tool = ctx.tools.find((t) => t.name === name);
      if (!tool) return rpcError(id, RPC.INVALID_PARAMS, `Unknown tool: ${name || "(none)"}`);
      const args = isObject(params.arguments) ? params.arguments : {};
      if (!tool.public && !hasKey(ctx.authorization)) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `This tool needs a Dealroom API key in the Authorization header ("Bearer drk_..."). Create one at ${ctx.keyHelpUrl} and add it to this server's configuration.`,
              },
            ],
            isError: true,
          },
        };
      }
      try {
        const res = await ctx.invoke(tool, args, ctx.authorization);
        return { jsonrpc: "2.0", id, result: await toolResult(res, tool) };
      } catch {
        return rpcError(id, RPC.INTERNAL_ERROR, "The tool failed; try again");
      }
    }
    default:
      return rpcError(id, RPC.METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
  }
}

/**
 * A POST body (one message or a batch). `null` body means 202 Accepted with
 * nothing to send back.
 */
export async function handlePayload(payload: unknown, ctx: McpContext): Promise<unknown | null> {
  if (Array.isArray(payload)) {
    if (payload.length === 0) return rpcError(null, RPC.INVALID_REQUEST, "Empty batch");
    const answers = (await Promise.all(payload.map((m) => handleMessage(m, ctx)))).filter(
      (a): a is JsonRpcResponse => a !== null,
    );
    return answers.length > 0 ? answers : null;
  }
  return handleMessage(payload, ctx);
}
