/**
 * Agent card
 *
 * GET /.well-known/agent.json (and /.well-known/agent-card.json)
 * Describes Dealroom for agents: what it does, the contract types, auth,
 * price and where to connect. Dealroom does not speak the A2A protocol:
 * `url` is the MCP endpoint and `interfaces` names MCP and REST, so an A2A
 * client is not sent to an HTML page as if it were an A2A endpoint.
 *
 * Contract types: `supportedContractTypes` is the one list of contract
 * types agents can make (the same codes as the guides, the MCP server
 * card, list_contract_types and llms-full.txt); `a2aProtocolTypes` are the
 * agent-to-agent protocol templates, negotiated only. The placeholder
 * template is in neither.
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
import {
  API_BASE,
  COMMON_CONTRACTS,
  CONTRACT_TYPES_URL,
  DISCOVERY_PATHS,
  MCP_URL,
  ONE_CALL_URL,
  allContractCodes,
  oneCallBody,
} from "@/lib/agent-discovery";
import { A2A_PREFIX, PLACEHOLDER_CONTRACT_TYPE } from "@/server/services/agent/contractTypes";

export async function GET() {
  if (!features.agentApi) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  // Fetch active templates to reflect current capabilities
  const templates = await prisma.contractTemplate.findMany({
    where: { isActive: true, NOT: { contractType: PLACEHOLDER_CONTRACT_TYPE } },
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
  // Every contract the one call makes, the common ones first (the same
  // list as the guides, the MCP server card and llms-full.txt).
  const codes = allContractCodes();
  const byCode = new Map(templates.map((t) => [t.contractType, t]));
  const describe = (t: (typeof templates)[number]) => ({
    contractType: t.contractType,
    displayName: t.displayName,
    jurisdictions: t.jurisdictions,
    languages: t.languages,
    isPremium: t.skillPackage?.isPremium ?? false,
  });

  const agentCard = {
    name: "Dealroom",
    description: features.stripeEnabled
      ? "Two-party contract negotiation platform. AI agents negotiate contracts using weighted compromise with lawyer-authored legal provisions. Negotiating is free; agents pay per contract with prepaid credits sold in packs of ten (amounts under pricing)."
      : "Two-party contract negotiation platform. AI agents negotiate contracts using weighted compromise with lawyer-authored legal provisions.",
    // Not an A2A endpoint: Dealroom is reached through MCP or REST.
    url: MCP_URL,
    interfaces: [
      {
        protocol: "mcp",
        transport: "streamable-http",
        url: MCP_URL,
        serverCard: `${baseUrl}${DISCOVERY_PATHS.serverCard}`,
      },
      { protocol: "rest", url: API_BASE, documentation: `${baseUrl}/developers` },
    ],
    a2a: {
      supported: false,
      note: `This card describes the service. Dealroom does not speak the A2A protocol: connect through the MCP server at ${MCP_URL} or the REST API at ${API_BASE}.`,
    },
    website: baseUrl,
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
        endpoint: { method: "POST", url: ONE_CALL_URL },
        mcpTool: "generate_contract",
        tags: ["contracts", "one-call", ...codes],
        contractTypes: codes,
        examples: COMMON_CONTRACTS.slice(0, 3).map((code) => JSON.stringify(oneCallBody(code, "en"))),
      },
      {
        id: "list-contract-types",
        name: "List Contract Types",
        description:
          "Every contract type the one call makes, with its code (send it as contractType), guide, governing laws, languages, roles and required inputs (GET /api/v1/agent/contract-types, no key; ?lang=es for Spanish). MCP tool: list_contract_types.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        endpoint: { method: "GET", url: CONTRACT_TYPES_URL },
        mcpTool: "list_contract_types",
        tags: ["contracts", "catalogue", ...codes],
        contractTypes: codes,
      },
      {
        id: "delete-deal",
        name: "Delete a Deal",
        description:
          "Delete one of your single-party deals and its data (DELETE /api/v1/agent/deals/:id, scope negotiate): the parties, the other side's details, the clause choices, the inputs and the contract. Answers 204. Only the account that made the deal can delete it; any other account, or a repeat, gets 404. A deal another party takes part in is refused with 409. The payment record is kept for billing, without names or contract text. MCP tool: delete_deal.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
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
    // The contract types agents can make and negotiate: the same codes as
    // the guides, the server card and list_contract_types.
    supportedContractTypes: codes.flatMap((code) => {
      const t = byCode.get(code);
      return t ? [describe(t)] : [];
    }),
    // Agent-to-agent protocol templates: negotiated only (get_template,
    // create_playbook, initiate_negotiation), never made in one call.
    a2aProtocolTypes: templates.filter((t) => t.contractType.startsWith(A2A_PREFIX)).map(describe),
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
      mcpServerCard: `${baseUrl}${DISCOVERY_PATHS.serverCard}`,
      mcpDiscovery: `${baseUrl}${DISCOVERY_PATHS.mcp}`,
      llms: `${baseUrl}${DISCOVERY_PATHS.llms}`,
      llmsFull: `${baseUrl}${DISCOVERY_PATHS.llmsFull}`,
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
