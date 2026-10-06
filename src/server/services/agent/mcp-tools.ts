// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The MCP tools of the agent API: one definition per tool, read by the
 * discovery JSON (GET /api/v1/agent/mcp) and by the MCP server itself
 * (POST /api/v1/agent/mcp, `tools/list`). Each tool runs one REST route,
 * named in `endpoint`, so the REST API and the MCP server cannot differ.
 */

export interface McpToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  endpoint: { method: "GET" | "POST"; url: string };
  requiredScopes: string[];
  /** Public tools run without an API key. */
  public?: boolean;
  readOnly?: boolean;
  errors?: { status: number; code: string; fix: string }[];
}

const GOVERNING_LAWS = ["CALIFORNIA", "NEW_YORK", "ENGLAND_WALES", "SPAIN"];

const partySchema = (who: string) => ({
  type: "object",
  description: who,
  properties: {
    legalName: { type: "string", description: "Full legal name of the company or person" },
    address: { type: "string", description: "Registered or postal address" },
    taxId: { type: "string", description: "Company or tax number, where the contract shows one" },
    signatoryName: { type: "string", description: "Name of the person who signs" },
    signatoryTitle: { type: "string", description: "Title of the person who signs, for example CEO" },
    email: { type: "string", format: "email" },
  },
  required: ["legalName"],
});

export function buildMcpTools(opts: {
  baseUrl: string;
  contractTypes: string[];
  stripeEnabled: boolean;
}): McpToolDef[] {
  const { baseUrl, contractTypes, stripeEnabled } = opts;
  return [
    {
      name: "list_contract_types",
      title: "List contract types",
      description:
        "Every contract type Dealroom can make, with the code to use as contractType, the guide slug, the governing laws and languages it is offered in, the role the caller can take (DPA and BAA only) and the inputs it asks for. Call this first to know what to ask the user. No API key needed.",
      inputSchema: {
        type: "object",
        properties: {
          lang: { type: "string", enum: ["en", "es"], default: "en", description: "Language of names and labels" },
        },
        required: [],
      },
      endpoint: { method: "GET", url: `${baseUrl}/contract-types?lang={lang}` },
      requiredScopes: [],
      public: true,
      readOnly: true,
    },
    {
      name: "generate_contract",
      title: "Make a contract in one call",
      description: stripeEnabled
        ? "Make a finished contract in one call: give the contract type, your side's details and, if you know them, the other side's. Clauses you leave out take the standard option. One prepaid credit is spent (the same price as any contract); with no credit the answer is HTTP 402 with code PAYMENT_REQUIRED and nothing is created. Returns the contract as Markdown, then the deal id, the link where the person can read it in Dealroom and the Markdown, HTML, PDF, DOCX and TXT links (free to fetch again)."
        : "Make a finished contract in one call: give the contract type, your side's details and, if you know them, the other side's. Clauses you leave out take the standard option. Payments are off on this deployment. Returns the contract as Markdown, then the deal id, the link where the person can read it in Dealroom and the Markdown, HTML, PDF, DOCX and TXT links.",
      inputSchema: {
        type: "object",
        properties: {
          contractType: {
            type: "string",
            description: "Code (for example NDA) or guide slug (for example nda), from list_contract_types",
          },
          governingLaw: {
            type: "string",
            enum: GOVERNING_LAWS,
            description: "Required when the contract type offers more than one",
          },
          language: { type: "string", enum: ["en", "es"], default: "en" },
          title: { type: "string", description: "Name of the deal; made from the parties when left out" },
          party: partySchema("Your side (the side the API key acts for)"),
          counterparty: partySchema("The other side. Left out: its block stays blank for it to complete."),
          role: {
            type: "string",
            description: "DPA and BAA only: the role you take (see roles in list_contract_types)",
          },
          terms: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Inputs by id (see inputs in list_contract_types); required ones must be given",
          },
          clauses: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Optional clause choices: clause id to option code (see get_template)",
          },
          inline: {
            type: "string",
            enum: ["md", "html", "txt"],
            default: "md",
            description: "The contract itself in the answer: md (Markdown, the default here), html or txt",
          },
          idempotencyKey: {
            type: "string",
            description: "Send the same value when retrying, so a retry never makes or charges a second contract",
          },
        },
        required: ["contractType", "party"],
      },
      endpoint: { method: "POST", url: `${baseUrl}/contracts` },
      requiredScopes: ["negotiate", "deals:read"],
      errors: stripeEnabled
        ? [{ status: 402, code: "PAYMENT_REQUIRED", fix: "buy_credits, then retry" }]
        : [],
    },
    {
      name: "list_templates",
      title: "List templates",
      description:
        "List available contract templates with clauses, options, and bias values. Use this to understand which contract types are available and what options exist for each clause. Pass `query` to search by code, abbreviation or name in English or Spanish (\"nda\", \"dpa\", \"hipaa\", \"confidencialidad\"), best match first.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional search: contract code, abbreviation or name (English or Spanish)",
          },
        },
        required: [],
      },
      endpoint: { method: "GET", url: `${baseUrl}/templates?q={query}` },
      requiredScopes: ["templates:read"],
      readOnly: true,
    },
    {
      name: "get_template",
      title: "Get a template",
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
      endpoint: { method: "GET", url: `${baseUrl}/templates/{contractType}` },
      requiredScopes: ["templates:read"],
      readOnly: true,
    },
    {
      name: "create_playbook",
      title: "Create a playbook",
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
          governingLaw: { type: "string", enum: GOVERNING_LAWS },
          contractLanguage: { type: "string", enum: ["en", "es"], default: "en" },
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
                acceptableOptions: { type: "array", items: { type: "string" } },
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
      title: "Start a negotiation",
      description:
        "Start a new contract negotiation. Returns a negotiation token for the respondent to join.",
      inputSchema: {
        type: "object",
        properties: {
          playbookId: { type: "string", description: "ID of your playbook" },
          dealName: { type: "string", description: "Human-readable deal name" },
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
      title: "Join a negotiation",
      description:
        "Join an existing negotiation as the respondent. Triggers automatic compromise resolution and returns the result.",
      inputSchema: {
        type: "object",
        properties: {
          negotiationToken: { type: "string", description: "Token from the initiator" },
          playbookId: { type: "string", description: "ID of your playbook (must match contract type)" },
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
      title: "Get a deal",
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
      readOnly: true,
    },
    {
      name: "download_contract",
      title: "Download a contract",
      description: stripeEnabled
        ? "Download the agreed contract as Markdown, HTML, PDF, DOCX or TXT (Markdown by default: agents read it best). Negotiation is free; the contract is paid when its document is first fetched: one prepaid credit of the customer is spent (any of its keys draws on the one balance). Later fetches of the same deal are free. With no credit left the answer is HTTP 402 with code PAYMENT_REQUIRED and the link to buy credits."
        : "Download the agreed contract as Markdown, HTML, PDF, DOCX or TXT (Markdown by default). Payments are off on this deployment; every contract is free.",
      inputSchema: {
        type: "object",
        properties: {
          dealId: { type: "string", description: "Agent deal room ID" },
          format: {
            type: "string",
            enum: ["pdf", "docx", "txt", "md", "html"],
            default: "md",
            description: "md (Markdown) or html for agents and tools; pdf, docx or txt for people and printers",
          },
        },
        required: ["dealId"],
      },
      endpoint: { method: "GET", url: `${baseUrl}/deals/{dealId}/document` },
      requiredScopes: ["deals:read"],
      errors: stripeEnabled
        ? [{ status: 402, code: "PAYMENT_REQUIRED", fix: "buy_credits, then retry" }]
        : [],
    },
    {
      name: "buy_credits",
      title: "Buy credits",
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
      title: "Credit balance",
      description:
        "Remaining contract credits of this API key's customer (one balance shared by all of its keys) and the latest ledger entries.",
      inputSchema: { type: "object", properties: {}, required: [] },
      endpoint: { method: "GET", url: `${baseUrl}/credits/balance` },
      requiredScopes: ["billing:read"],
      readOnly: true,
    },
    {
      name: "get_subscriptions",
      title: "Earlier subscriptions",
      description:
        "List earlier per-skill subscriptions and their status. Skills are no longer sold one by one; every template is included.",
      inputSchema: { type: "object", properties: {}, required: [] },
      endpoint: { method: "GET", url: `${baseUrl}/subscriptions` },
      requiredScopes: ["billing:read"],
      readOnly: true,
    },
  ];
}
