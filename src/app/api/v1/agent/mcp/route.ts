// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * MCP server and tool discovery.
 *
 * POST /api/v1/agent/mcp
 *   The MCP server (Streamable HTTP, JSON answers, no sessions): what an
 *   MCP client such as Claude, Cursor or VS Code connects to. See
 *   `src/server/services/agent/mcp-protocol.ts`.
 *
 * GET /api/v1/agent/mcp
 *   The same tools as plain JSON, each with the REST endpoint it runs,
 *   plus the price block. A client asking for an event stream gets 405:
 *   this server sends no messages of its own.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { apiError } from "@/lib/api-response";
import { API_KEYS_SETTINGS_PATH } from "@/lib/api-key-scopes";
import { agentPricingBlock } from "@/server/services/billing/pricing";
import { buildMcpTools } from "@/server/services/agent/mcp-tools";
import { handlePayload, rpcError, RPC } from "@/server/services/agent/mcp-protocol";
import { invokeTool } from "@/server/services/agent/mcp-invoke";

const SERVER_VERSION = "1.1.0";

async function tools() {
  const templates = await prisma.contractTemplate.findMany({
    where: { isActive: true },
    select: { contractType: true },
    orderBy: { displayName: "asc" },
  });
  return buildMcpTools({
    baseUrl: `https://${brand.appDomain}/api/v1/agent`,
    contractTypes: templates.map((t) => t.contractType),
    stripeEnabled: features.stripeEnabled,
  });
}

function notAllowed() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET, POST" } });
}

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const accept = req.headers.get("Accept") || "";
    if (accept.includes("text/event-stream") && !accept.includes("application/json")) {
      return notAllowed();
    }

    const baseUrl = `https://${brand.appDomain}`;
    return NextResponse.json(
      {
        schema_version: "1.0",
        name: "dealroom",
        description:
          "Contract drafting and negotiation: make a contract in one call, or negotiate it clause by clause with a published compromise formula.",
        mcpServer: {
          transport: "streamable-http",
          url: `${baseUrl}/api/v1/agent/mcp`,
          setup: `${baseUrl}/developers`,
        },
        tools: (await tools()).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          endpoint: t.endpoint,
          requiredScopes: t.requiredScopes,
          ...(t.public ? { public: true } : {}),
          ...(t.errors ? { errors: t.errors } : {}),
        })),
        pricing: await agentPricingBlock(),
        authentication: {
          type: "bearer",
          description: "API key with drk_ prefix",
        },
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    return apiError(error, "Failed to load MCP tool definitions");
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(rpcError(null, RPC.PARSE_ERROR, "The body must be JSON"), { status: 400 });
    }

    const answer = await handlePayload(payload, {
      tools: await tools(),
      invoke: invokeTool,
      authorization: req.headers.get("Authorization"),
      serverVersion: SERVER_VERSION,
      keyHelpUrl: `https://${brand.appDomain}${API_KEYS_SETTINGS_PATH}`,
    });
    if (answer === null) return new NextResponse(null, { status: 202 });
    return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "The MCP request failed");
  }
}

export async function DELETE() {
  // No sessions to end.
  return notAllowed();
}
