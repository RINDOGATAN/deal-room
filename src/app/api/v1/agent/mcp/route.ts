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
              enum: ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
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
        description:
          "Download the agreed contract as a PDF document.",
        inputSchema: {
          type: "object",
          properties: {
            dealId: { type: "string", description: "Agent deal room ID" },
            format: {
              type: "string",
              enum: ["pdf", "docx"],
              default: "pdf",
            },
          },
          required: ["dealId"],
        },
        endpoint: {
          method: "GET",
          url: `${baseUrl}/deals/{dealId}/document`,
        },
        requiredScopes: ["deals:read"],
      },
      {
        name: "get_subscriptions",
        description:
          "Check your current premium skill subscriptions and their status.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
        endpoint: { method: "GET", url: `${baseUrl}/subscriptions` },
        requiredScopes: ["billing:read"],
      },
      {
        name: "subscribe",
        description:
          "Subscribe to premium skills. Returns a Stripe Checkout URL to complete payment in a browser. Entitlements activate automatically after payment.",
        inputSchema: {
          type: "object",
          properties: {
            skillIds: {
              type: "array",
              items: { type: "string" },
              description:
                "Skill IDs to subscribe to (e.g. com.nel.skills.consulting). Omit to list available skills.",
            },
            returnUrl: {
              type: "string",
              description: "URL to redirect to after checkout",
            },
          },
          required: ["skillIds"],
        },
        endpoint: { method: "POST", url: `${baseUrl}/subscribe` },
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
