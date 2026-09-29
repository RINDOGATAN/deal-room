// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * MCP Tool Definitions
 *
 * GET /api/v1/agent/mcp
 * Returns MCP-compatible tool definitions for Dealroom operations.
 * Discovery-only — execution goes through existing REST endpoints.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { apiError } from "@/lib/api-response";
import { agentPricingBlock } from "@/server/services/billing/pricing";

export async function GET() {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const baseUrl = `https://${brand.appDomain}/api/v1/agent`;

    // Fetch available contract types for enum values
    const templates = await prisma.contractTemplate.findMany({
      where: { isActive: true },
      select: { contractType: true, displayName: true },
      orderBy: { displayName: "asc" },
    });

    const contractTypes = templates.map((t) => t.contractType);

    const tools = [
      {
        name: "list_templates",
        description:
          "List available contract templates with clauses, options, and bias values. Use this to understand which contract types are available and what options exist for each clause.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
        endpoint: { method: "GET", url: `${baseUrl}/templates` },
        requiredScopes: ["templates:read"],
      },
      {
        name: "get_template",
        description:
          "Get full details for a specific contract template including all clauses and their options with bias values.",
        inputSchema: {
          type: "object",
          properties: {
            contractType: {
              type: "string",
              description: "Contract type identifier",
              enum: contractTypes,
            },
          },
          required: ["contractType"],
        },
        endpoint: {
          method: "GET",
          url: `${baseUrl}/templates/{contractType}`,
        },
        requiredScopes: ["templates:read"],
      },
      {
        name: "create_playbook",
        description:
          "Create a negotiation playbook defining preferences for each clause: preferred option, priority (1-5), flexibility (1-5), red lines, and acceptable alternatives.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Unique playbook name" },
            contractType: {
              type: "string",
              description: "Contract type",
              enum: contractTypes,
            },
            governingLaw: {
              type: "string",
              enum: ["CALIFORNIA", "NEW_YORK", "ENGLAND_WALES", "SPAIN"],
            },
            contractLanguage: {
              type: "string",
              enum: ["en", "es"],
              default: "en",
            },
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  clauseId: { type: "string" },
                  preferredOptionId: { type: "string" },
                  priority: { type: "integer", minimum: 1, maximum: 5 },
                  flexibility: { type: "integer", minimum: 1, maximum: 5 },
                  isRedLine: { type: "boolean" },
                  acceptableOptions: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["clauseId", "preferredOptionId"],
              },
            },
          },
          required: ["name", "contractType", "governingLaw", "entries"],
        },
        endpoint: { method: "POST", url: `${baseUrl}/playbooks` },
        requiredScopes: ["playbook:write"],
      },
      {
        name: "initiate_negotiation",
        description:
          "Start a new contract negotiation. Returns a negotiation token for the respondent to join.",
        inputSchema: {
          type: "object",
          properties: {
            playbookId: {
              type: "string",
              description: "ID of your playbook",
            },
            dealName: {
              type: "string",
              description: "Human-readable deal name",
            },
            initiatorEmail: { type: "string", format: "email" },
            initiatorCompany: { type: "string" },
            respondentEmail: { type: "string", format: "email" },
            respondentCompany: { type: "string" },
          },
          required: ["playbookId", "dealName", "initiatorEmail"],
        },
        endpoint: { method: "POST", url: `${baseUrl}/negotiate` },
        requiredScopes: ["negotiate"],
      },
      {
        name: "join_negotiation",
        description:
          "Join an existing negotiation as the respondent. Triggers automatic compromise resolution and returns the result.",
        inputSchema: {
          type: "object",
          properties: {
            negotiationToken: {
              type: "string",
              description: "Token from the initiator",
            },
            playbookId: {
              type: "string",
              description: "ID of your playbook (must match contract type)",
            },
            respondentEmail: { type: "string", format: "email" },
            respondentCompany: { type: "string" },
          },
          required: ["negotiationToken", "playbookId", "respondentEmail"],
        },
        endpoint: { method: "POST", url: `${baseUrl}/negotiate/join` },
        requiredScopes: ["negotiate"],
      },
      {
        name: "get_deal",
        description:
          "Get deal details including per-clause agreed options, satisfaction scores, and reasoning.",
        inputSchema: {
          type: "object",
          properties: {
            dealId: { type: "string", description: "Agent deal room ID" },
          },
          required: ["dealId"],
        },
        endpoint: { method: "GET", url: `${baseUrl}/deals/{dealId}` },
        requiredScopes: ["deals:read"],
      },
      {
        name: "download_contract",
        description: features.stripeEnabled
          ? "Download the agreed contract (PDF, DOCX or TXT). Negotiation is free; the contract is paid when its document is first fetched: one prepaid credit of the customer is spent (any of its keys draws on the one balance). Later fetches of the same deal are free. With no credit left the answer is HTTP 402 with code PAYMENT_REQUIRED and the link to buy credits."
          : "Download the agreed contract (PDF, DOCX or TXT). Payments are off on this deployment; every contract is free.",
        inputSchema: {
          type: "object",
          properties: {
            dealId: { type: "string", description: "Agent deal room ID" },
            format: {
              type: "string",
              enum: ["pdf", "docx", "txt"],
              default: "pdf",
              description: "pdf → /document, docx → /document/docx, txt → /document/txt",
            },
          },
          required: ["dealId"],
        },
        endpoint: {
          method: "GET",
          url: `${baseUrl}/deals/{dealId}/document`,
        },
        requiredScopes: ["deals:read"],
        errors: features.stripeEnabled
          ? [{ status: 402, code: "PAYMENT_REQUIRED", fix: "buy_credits, then retry" }]
          : [],
      },
      {
        name: "buy_credits",
        description:
          "Open a hosted checkout for a pack of ten contract credits for this API key's customer (any of its keys can spend them). Returns checkoutUrl for a person to open in a browser; the credits arrive when the payment succeeds. Answers 409 where payments are off.",
        inputSchema: {
          type: "object",
          properties: {
            currency: { type: "string", enum: ["usd", "eur"], default: "usd" },
            returnUrl: { type: "string", description: "URL to return to after checkout" },
          },
          required: [],
        },
        endpoint: { method: "POST", url: `${baseUrl}/credits/checkout` },
        requiredScopes: ["billing:read"],
      },
      {
        name: "get_credit_balance",
        description:
          "Remaining contract credits of this API key's customer (one balance shared by all of its keys) and the latest ledger entries.",
        inputSchema: { type: "object", properties: {}, required: [] },
        endpoint: { method: "GET", url: `${baseUrl}/credits/balance` },
        requiredScopes: ["billing:read"],
      },
      {
        name: "get_subscriptions",
        description:
          "List earlier per-skill subscriptions and their status. Skills are no longer sold one by one; every template is included.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
        endpoint: { method: "GET", url: `${baseUrl}/subscriptions` },
        requiredScopes: ["billing:read"],
      },
    ];

    return NextResponse.json(
      {
        schema_version: "1.0",
        name: "dealroom",
        description:
          "Contract negotiation platform — negotiate, compromise, and generate legal agreements between AI agents.",
        tools,
        pricing: await agentPricingBlock(),
        authentication: {
          type: "bearer",
          description: "API key with drk_ prefix",
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (error) {
    return apiError(error, "Failed to load MCP tool definitions");
  }
}
