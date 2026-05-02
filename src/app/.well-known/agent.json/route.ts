/**
 * A2A Agent Card
 *
 * GET /.well-known/agent.json
 * Returns a standard A2A Agent Card describing Dealroom's
 * negotiation capabilities, supported contract types, and auth.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { brand } from "@/config/brand";

export async function GET() {
  if (!features.agentApi) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  // Fetch active templates to reflect current capabilities
  const templates = await prisma.contractTemplate.findMany({
    where: { isActive: true },
    select: {
      contractType: true,
      displayName: true,
      jurisdictions: true,
      languages: true,
      skillPackage: {
        select: { isPremium: true },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const baseUrl = `https://${brand.appDomain}`;

  const agentCard = {
    name: "Dealroom",
    description:
      "Two-party contract negotiation platform. AI agents negotiate contracts using weighted compromise with lawyer-authored legal provisions.",
    url: baseUrl,
    version: "1.0.0",
    provider: {
      organization: brand.company,
      url: `https://${brand.domain}`,
    },
    capabilities: {
      streaming: false,
      pushNotifications: true,
      stateTransitionHistory: true,
      idempotency: {
        supported: true,
        header: "Idempotency-Key",
        ttlSeconds: 24 * 60 * 60,
        appliesTo: [
          "POST /api/v1/agent/negotiate",
          "POST /api/v1/agent/negotiate/join",
          "POST /api/v1/agent/playbooks",
          "POST /api/v1/agent/subscribe",
          "POST /api/v1/agent/webhooks",
          "POST /api/v1/agent/deals/:id/accept",
          "POST /api/v1/agent/deals/:id/reject",
          "POST /api/v1/agent/deals/:id/counter",
          "POST /api/v1/agent/deals/:id/dispute",
        ],
        description:
          "Send Idempotency-Key on retries to receive the original response without re-executing the handler. Cached for 24h. Replays carry an Idempotent-Replay: true response header.",
      },
    },
    authentication: {
      schemes: [
        {
          scheme: "bearer",
          description:
            "API key with drk_ prefix. Issued per customer via admin panel.",
          scopes: [
            { name: "templates:read", description: "List and view contract templates" },
            { name: "playbook:read", description: "List and view playbooks" },
            { name: "playbook:write", description: "Create, update, delete playbooks" },
            { name: "negotiate", description: "Initiate and join negotiations" },
            { name: "deals:read", description: "View deals and download documents" },
            { name: "billing:read", description: "View credit balance" },
            { name: "webhooks:manage", description: "Manage webhook endpoints" },
            { name: "disputes:create", description: "Escalate failed/agreed deals to Gavel ADR" },
          ],
        },
      ],
    },
    skills: [
      {
        id: "negotiate-contract",
        name: "Negotiate Contract",
        description:
          "Negotiate a two-party contract using playbooks and weighted compromise. Returns agreed terms or failure reason.",
        inputModes: ["application/json"],
        outputModes: ["application/json", "application/pdf"],
        parameters: {
          playbookId: {
            type: "string",
            required: true,
            description: "ID of the negotiation playbook to use",
          },
          dealName: {
            type: "string",
            required: true,
            description: "Human-readable name for the deal",
          },
          initiatorEmail: {
            type: "string",
            required: true,
            description: "Initiator contact email",
          },
        },
      },
      {
        id: "list-templates",
        name: "List Contract Templates",
        description:
          "List available contract templates with clause details and bias values.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "manage-playbook",
        name: "Manage Playbook",
        description:
          "Create and manage negotiation playbooks with clause preferences, priorities, flexibility scores, and red lines.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
    ],
    supportedContractTypes: templates.map((t) => ({
      contractType: t.contractType,
      displayName: t.displayName,
      jurisdictions: t.jurisdictions,
      languages: t.languages,
      isPremium: t.skillPackage?.isPremium ?? false,
    })),
    endpoints: {
      templates: `${baseUrl}/api/v1/agent/templates`,
      playbooks: `${baseUrl}/api/v1/agent/playbooks`,
      negotiate: `${baseUrl}/api/v1/agent/negotiate`,
      deals: `${baseUrl}/api/v1/agent/deals`,
      subscriptions: `${baseUrl}/api/v1/agent/subscriptions`,
      subscribe: `${baseUrl}/api/v1/agent/subscribe`,
      webhooks: `${baseUrl}/api/v1/agent/webhooks`,
      mcp: `${baseUrl}/api/v1/agent/mcp`,
    },
    documentation: `${baseUrl}/docs/agent-api`,
  };

  return NextResponse.json(agentCard, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
