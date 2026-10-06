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
import { agentPricingBlock } from "@/server/services/billing/pricing";
import {
  AGENT_API_SCOPES,
  API_KEYS_SETTINGS_PATH,
  MAX_ACTIVE_KEYS_PER_CUSTOMER,
} from "@/lib/api-key-scopes";

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
    description: features.stripeEnabled
      ? "Two-party contract negotiation platform. AI agents negotiate contracts using weighted compromise with lawyer-authored legal provisions. Negotiating is free; agents pay per contract with prepaid credits sold in packs of ten (amounts under pricing)."
      : "Two-party contract negotiation platform. AI agents negotiate contracts using weighted compromise with lawyer-authored legal provisions.",
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
          "POST /api/v1/agent/contracts",
          "POST /api/v1/agent/deals",
          "POST /api/v1/agent/negotiate",
          "POST /api/v1/agent/negotiate/join",
          "POST /api/v1/agent/playbooks",
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
          description: features.selfServiceApiKeys
            ? `API key with drk_ prefix. A person creates it after signing in, under Settings, API keys (${baseUrl}${API_KEYS_SETTINGS_PATH}). The full key is shown once. Up to ${MAX_ACTIVE_KEYS_PER_CUSTOMER} active keys per account; all of them spend the account's credits.`
            : "API key with drk_ prefix. Issued per customer via admin panel.",
          ...(features.selfServiceApiKeys
            ? { keyCreationUrl: `${baseUrl}${API_KEYS_SETTINGS_PATH}` }
            : {}),
          scopes: AGENT_API_SCOPES.map(({ name, description }) => ({ name, description })),
        },
      ],
    },
    skills: [
      {
        id: "generate-contract",
        name: "Make a Contract in One Call",
        description:
          "Make a finished single-party contract in one call (POST /api/v1/agent/contracts): contract type, your side's details, optionally the other side's, and the required inputs. Clauses left out take the standard option. Spends one credit where billing is on. GET /api/v1/agent/contract-types lists what each type needs (no key).",
        inputModes: ["application/json"],
        outputModes: ["application/json", "text/markdown", "text/html", "text/plain", "application/pdf"],
      },
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
      contracts: `${baseUrl}/api/v1/agent/contracts`,
      contractTypes: `${baseUrl}/api/v1/agent/contract-types`,
      templates: `${baseUrl}/api/v1/agent/templates`,
      playbooks: `${baseUrl}/api/v1/agent/playbooks`,
      negotiate: `${baseUrl}/api/v1/agent/negotiate`,
      deals: `${baseUrl}/api/v1/agent/deals`,
      subscriptions: `${baseUrl}/api/v1/agent/subscriptions`,
      creditsCheckout: `${baseUrl}/api/v1/agent/credits/checkout`,
      creditsBalance: `${baseUrl}/api/v1/agent/credits/balance`,
      webhooks: `${baseUrl}/api/v1/agent/webhooks`,
      mcp: `${baseUrl}/api/v1/agent/mcp`,
    },
    // Machine-readable price. Amounts are minor units (2900 = 29.00), read
    // from the Stripe prices this deployment is configured with; `display`
    // follows PRICE_DISPLAY_* when set. Credits are held per customer.
    pricing: await agentPricingBlock(),
    documentation: `${baseUrl}/docs/agent-api`,
    quickStart: `${baseUrl}/developers`,
  };

  return NextResponse.json(agentCard, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
