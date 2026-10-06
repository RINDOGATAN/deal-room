// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What agents need to find and call Dealroom, from one source.
 *
 * The contract list is `CONTRACT_PAGES` (one public guide per contract
 * type) and what each type needs is `agent-contract-types.json`, a copy of
 * the public GET /api/v1/agent/contract-types refreshed by
 * `scripts/agent-contract-types-sync.mjs`. Everything here is built from
 * those two: the "Make this contract from your AI agent" block of each
 * guide and its JSON-LD, the MCP server card (/.well-known/mcp.json and
 * /.well-known/mcp/server-card.json), the contract list of the agent card,
 * /llms-full.txt and the ranked list on /developers. No database and no
 * file-system access, so the pages that use it can be prerendered.
 */

import snapshot from "./agent-contract-types.json";
import serverJson from "../../server.json";
import { CONTRACT_PAGES, SITE_URL, contractPath, developersPath, type PageLocale } from "./contract-pages-paths";
import { API_BASE, KEY_PLACEHOLDER, MCP_URL } from "./developer-snippets";
import { REQUIRED_INPUTS_RULE, defaultsIfLeftOut, inputNotes, mustSend, requiredInputs } from "./agent-inputs";

export { API_BASE, KEY_PLACEHOLDER, MCP_URL };
export const ONE_CALL_URL = `${API_BASE}/contracts`;
export const CONTRACT_TYPES_URL = `${API_BASE}/contract-types`;

/** The MCP server's version and registry name, as published in server.json. */
export const MCP_SERVER_VERSION: string = serverJson.version;
export const MCP_REGISTRY_NAME: string = serverJson.name;

export const DISCOVERY_PATHS = {
  mcp: "/.well-known/mcp.json",
  serverCard: "/.well-known/mcp/server-card.json",
  agentCard: "/.well-known/agent.json",
  llms: "/llms.txt",
  llmsFull: "/llms-full.txt",
  developersMd: "/developers.md",
} as const;

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

// ---------------------------------------------------------------------------
// Contract types

export interface AgentInput {
  id: string;
  type: string;
  options?: string[];
  default?: string;
  onlyUnder?: string[];
}

export interface AgentContractType {
  contractType: string;
  slug: string;
  governingLaws: string[];
  languages: string[];
  roles: string[] | null;
  requiredInputs: AgentInput[];
}

const SNAPSHOT = (snapshot as { contractTypes: AgentContractType[] }).contractTypes;

export function agentContractType(code: string): AgentContractType | undefined {
  return SNAPSHOT.find((t) => t.contractType === code);
}

/**
 * The contracts agents ask for most, in that order (owner, 6 October
 * 2026). The rest follow in the order of the contract guides.
 */
export const COMMON_CONTRACTS = [
  "NDA",
  "DPA",
  "MSA",
  "SAAS",
  "CONSULTING",
  "EMPLOYMENT",
  "IP_ASSIGNMENT",
  "SAFE",
  "CONVERTIBLE_NOTE",
  "ADVISORY",
  "PRIVACY_NOTICE",
] as const;

/** Every contract type with a guide, the common ones first. */
export function rankedContractPages() {
  const rank = (code: string) => {
    const i = (COMMON_CONTRACTS as readonly string[]).indexOf(code);
    return i === -1 ? COMMON_CONTRACTS.length : i;
  };
  return CONTRACT_PAGES.map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p.contractType) - rank(b.p.contractType) || a.i - b.i)
    .map(({ p }) => p);
}

export function allContractCodes(): string[] {
  return rankedContractPages().map((p) => p.contractType);
}

/**
 * Inputs a caller must send: required, with no default (under `law`, when
 * given). Used to fill the examples only; every listing shows all the
 * required inputs with their defaults (`agent-inputs.ts`).
 */
export function mustSendInputs(t: AgentContractType | undefined, law?: string | null): AgentInput[] {
  return requiredInputs(t?.requiredInputs, law).filter(mustSend);
}

const LAW_PREFERENCE: Record<PageLocale, string[]> = {
  en: ["ENGLAND_WALES", "CALIFORNIA", "SPAIN", "NEW_YORK"],
  es: ["SPAIN", "ENGLAND_WALES", "CALIFORNIA", "NEW_YORK"],
};

/** The governing law the example sends: none where the type offers only one. */
export function exampleLaw(t: AgentContractType | undefined, locale: PageLocale): string | null {
  const laws = t?.governingLaws ?? [];
  if (laws.length <= 1) return null;
  return LAW_PREFERENCE[locale].find((l) => laws.includes(l)) ?? laws[0];
}

const EXAMPLE_VALUE: Record<string, string> = {
  currency: "10000",
  number: "12",
  percentage: "10",
  date: "2026-11-01",
};

/** A sample value for an input, for the example only. */
export function exampleValue(input: AgentInput): string {
  if (input.options?.length) return input.options[0];
  return EXAMPLE_VALUE[input.type] ?? `<${input.id}>`;
}

/** The JSON body of the one call for a contract type. */
export function oneCallBody(code: string, locale: PageLocale): Record<string, unknown> {
  const t = agentContractType(code);
  const es = locale === "es";
  const law = exampleLaw(t, locale);
  const languages = t?.languages ?? [];
  const language = languages.includes(locale) ? locale : (languages[0] ?? "en");
  const terms = Object.fromEntries(mustSendInputs(t, law ?? t?.governingLaws[0]).map((i) => [i.id, exampleValue(i)]));
  return {
    contractType: code,
    ...(law ? { governingLaw: law } : {}),
    language,
    party: { legalName: es ? "Tu empresa" : "Your company" },
    counterparty: { legalName: es ? "La otra empresa" : "The other company" },
    ...(Object.keys(terms).length ? { terms } : {}),
    inline: "md",
  };
}

/** The one call with curl, for a contract type. */
export function oneCallCurl(code: string, locale: PageLocale): string {
  return [
    `curl -X POST ${ONE_CALL_URL} \\`,
    `  -H "Authorization: Bearer ${KEY_PLACEHOLDER}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: $(uuidgen)" \\`,
    `  -d '${JSON.stringify(oneCallBody(code, locale), null, 2).replace(/\n/g, "\n  ")}'`,
  ].join("\n");
}

/** Where a guide's agent block lives (the one-call example of that contract). */
export function agentBlockPath(locale: PageLocale, slug: string): string {
  return `${contractPath(locale, slug)}#agent`;
}

export function developersMcpPath(locale: PageLocale): string {
  return `${developersPath(locale)}#mcp`;
}

// ---------------------------------------------------------------------------
// JSON-LD for a guide

/** The WebAPI node of a guide: the one call that makes this contract. */
export function contractAgentJsonLd(opts: {
  locale: PageLocale;
  slug: string;
  code: string;
  name: string;
  apiName: string;
  actionName: string;
}): Record<string, unknown> {
  const url = `${SITE_URL}${contractPath(opts.locale, opts.slug)}`;
  return {
    "@type": "WebAPI",
    "@id": `${url}#agent`,
    name: opts.apiName,
    url: API_BASE,
    documentation: `${SITE_URL}${developersMcpPath(opts.locale)}`,
    inLanguage: opts.locale,
    provider: { "@type": "Organization", name: "TODO.LAW", url: "https://todo.law" },
    subjectOf: { "@id": `${url}#article` },
    potentialAction: {
      "@type": "CreateAction",
      name: opts.actionName,
      target: {
        "@type": "EntryPoint",
        urlTemplate: ONE_CALL_URL,
        httpMethod: "POST",
        contentType: "application/json",
        encodingType: "application/json",
      },
      object: {
        "@type": "DigitalDocument",
        name: opts.name,
        identifier: opts.code,
        additionalType: "contractType",
      },
      instrument: {
        "@type": "SoftwareApplication",
        name: "Dealroom MCP server",
        applicationCategory: "DeveloperApplication",
        url: MCP_URL,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// MCP server card and /.well-known/mcp.json

export interface CardTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const DESCRIPTION =
  "Make a contract in one call, or negotiate it clause by clause with a published compromise formula. " +
  "Covers NDA, DPA, MSA, SaaS, consulting, employment, IP assignment, SAFE, convertible note, advisory, privacy notice and more.";

const AUTH = {
  required: true,
  schemes: ["bearer"],
  header: "Authorization",
  format: `Bearer ${KEY_PLACEHOLDER}`,
  description:
    "A Dealroom API key (it starts with drk_) in the Authorization header. A person creates it after signing in, under Settings, API keys. list_contract_types works without a key.",
  keyCreationUrl: `${SITE_URL}/settings/api-keys`,
};

/** The MCP server card (the draft server-card format), with every tool. */
export function mcpServerCard(opts: { tools: CardTool[]; protocolVersion: string }): Record<string, unknown> {
  return {
    version: "1.0",
    protocolVersion: opts.protocolVersion,
    serverInfo: { name: MCP_REGISTRY_NAME, title: "Dealroom", version: MCP_SERVER_VERSION },
    description: DESCRIPTION,
    iconUrl: `${SITE_URL}/icon-512.png`,
    documentationUrl: `${SITE_URL}${developersMcpPath("en")}`,
    websiteUrl: `${SITE_URL}/developers`,
    repository: serverJson.repository,
    transport: { type: "streamable-http", endpoint: MCP_URL },
    capabilities: { tools: { listChanged: false } },
    authentication: AUTH,
    instructions:
      `Call list_contract_types to learn the code and required inputs of a contract, then generate_contract with contractType, party and those inputs in terms. ${REQUIRED_INPUTS_RULE.en} Clauses left out take the standard option. Each contract made spends one prepaid credit.`,
    tools: opts.tools.map((t) => ({
      name: t.name,
      ...(t.title ? { title: t.title } : {}),
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    contractTypes: { list: CONTRACT_TYPES_URL, guides: `${SITE_URL}${contractPath("en")}`, codes: allContractCodes() },
  };
}

/** /.well-known/mcp.json: where the server is, how to connect, and what it makes. */
export function mcpDiscovery(opts: { toolNames: string[] }): Record<string, unknown> {
  return {
    name: "Dealroom",
    description: DESCRIPTION,
    version: MCP_SERVER_VERSION,
    serverCard: abs(DISCOVERY_PATHS.serverCard),
    registry: { name: MCP_REGISTRY_NAME, url: "https://registry.modelcontextprotocol.io" },
    mcpServers: {
      dealroom: {
        type: "http",
        transport: "streamable-http",
        url: MCP_URL,
        headers: { Authorization: `Bearer ${KEY_PLACEHOLDER}` },
      },
    },
    authentication: AUTH,
    tools: opts.toolNames,
    setup: abs(developersMcpPath("en")),
    oneCall: { method: "POST", url: ONE_CALL_URL, tool: "generate_contract" },
    links: {
      agentCard: abs(DISCOVERY_PATHS.agentCard),
      llms: abs(DISCOVERY_PATHS.llms),
      llmsFull: abs(DISCOVERY_PATHS.llmsFull),
      developers: abs("/developers"),
      developersMarkdown: abs(DISCOVERY_PATHS.developersMd),
    },
    contractTypes: {
      list: CONTRACT_TYPES_URL,
      requiredInputsRule: REQUIRED_INPUTS_RULE.en,
      items: rankedContractPages().map((p) => {
        const t = agentContractType(p.contractType);
        return {
          contractType: p.contractType,
          guide: abs(contractPath("en", p.slug)),
          agentExample: abs(agentBlockPath("en", p.slug)),
          governingLaws: t?.governingLaws ?? [],
          languages: t?.languages ?? [],
          // Every required input; those with a default may be left out
          // and take the default listed here.
          requiredInputs: requiredInputs(t?.requiredInputs).map((i) => i.id),
          ...(Object.keys(defaultsIfLeftOut(t?.requiredInputs)).length
            ? { defaultsIfLeftOut: defaultsIfLeftOut(t?.requiredInputs) }
            : {}),
        };
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// /llms-full.txt

function inputLine(i: AgentInput): string {
  const notes = [i.type, ...(i.options?.length ? [`one of ${i.options.join(", ")}`] : []), ...inputNotes(i, "en")];
  return `\`${i.id}\` (${notes.join("; ")})`;
}

export function llmsFullText(opts: {
  /** English name of each contract type, by code. */
  names: Record<string, string>;
  tools: { name: string; text: string }[];
  snippets: { name: string; code: string }[];
}): string {
  const pages = rankedContractPages();
  const out: string[] = [
    "# Dealroom: full context for AI agents",
    "",
    "> Dealroom drafts and negotiates contracts. An AI agent can make a finished contract in one call, through the REST API or the MCP server, from lawyer-written templates in English and Castilian Spanish. Clauses left out take the standard option. Each contract made through the API or MCP spends one prepaid credit.",
    "",
    `Short version: ${abs(DISCOVERY_PATHS.llms)}`,
    "",
    "## Discovery files",
    "",
    `- MCP server card: ${abs(DISCOVERY_PATHS.serverCard)}`,
    `- MCP discovery: ${abs(DISCOVERY_PATHS.mcp)}`,
    `- Agent card (describes the service; connect through the MCP server or the REST API, not A2A): ${abs(DISCOVERY_PATHS.agentCard)}`,
    `- Developer quick start: ${abs("/developers")} (Markdown: ${abs(DISCOVERY_PATHS.developersMd)}; Spanish: ${abs("/es/developers")})`,
    `- Contract types and the inputs each needs (JSON, no key): ${CONTRACT_TYPES_URL} (Spanish: ${CONTRACT_TYPES_URL}?lang=es)`,
    "",
    "## Get an API key and credits",
    "",
    `1. Sign in at ${SITE_URL} and open Settings, API keys (${SITE_URL}/settings/api-keys). Choose Create key and copy it: it starts with drk_ and is shown once.`,
    "2. On the same page, buy credits. Each contract made through the API or MCP spends one credit. With no credit the answer is HTTP 402 with code PAYMENT_REQUIRED and nothing is created.",
    "",
    "## Make a contract in one call",
    "",
    `\`POST ${ONE_CALL_URL}\` with \`Authorization: Bearer drk_...\`. Body: \`contractType\` (the code), \`party\` (your side: \`legalName\` required; \`address\`, \`taxId\`, \`signatoryName\`, \`signatoryTitle\`, \`email\` optional), optional \`counterparty\` (same shape), \`governingLaw\` (needed only when the type offers more than one), \`language\` (\`en\` or \`es\`), \`terms\` (the required inputs, by id), \`clauses\` (clause id to option code), \`role\` (DPA and BAA) and \`inline\` (\`md\`, \`html\` or \`txt\`). Send an \`Idempotency-Key\` header so a retry is not charged twice.`,
    "",
    "```sh",
    oneCallCurl("NDA", "en"),
    "```",
    "",
    "## MCP server",
    "",
    `- Address: ${MCP_URL}`,
    "- Transport: Streamable HTTP (JSON answers, no sessions)",
    "- Authentication: `Authorization: Bearer drk_YOUR_KEY`",
    `- Registry name: ${MCP_REGISTRY_NAME}`,
    "",
    "### Tools",
    "",
    ...opts.tools.map((t) => `- \`${t.name}\`: ${t.text}`),
    "",
    "### Setup by client",
    "",
  ];
  for (const s of opts.snippets) {
    out.push(`#### ${s.name}`, "", "```", s.code, "```", "");
  }
  out.push(
    `## Contract types (${pages.length})`,
    "",
    `Send the code as \`contractType\`. The most common contracts come first. ${REQUIRED_INPUTS_RULE.en}`,
    "",
  );
  for (const p of pages) {
    const t = agentContractType(p.contractType);
    const name = opts.names[p.contractType] ?? p.contractType;
    const required = requiredInputs(t?.requiredInputs);
    out.push(
      `### ${name} (\`${p.contractType}\`)`,
      "",
      `- Guide: ${abs(contractPath("en", p.slug))} (Spanish: ${abs(contractPath("es", p.slug))})`,
      `- Code: \`${p.contractType}\` (the slug \`${p.slug}\` also works)`,
      `- Governing laws: ${(t?.governingLaws ?? []).join(", ") || "see the contract types list"}`,
      `- Languages: ${(t?.languages ?? []).join(", ") || "see the contract types list"}`,
      ...(t?.roles?.length ? [`- Roles (\`role\`): ${t.roles.join(", ")} (default ${t.roles[0]})`] : []),
      `- Required inputs: ${required.length ? required.map(inputLine).join(", ") : "none"}`,
      "- One call body:",
      "",
      "```json",
      JSON.stringify(oneCallBody(p.contractType, "en"), null, 2),
      "```",
      "",
    );
  }
  out.push(
    "---",
    "",
    "The contracts come from templates written by lawyers. Read each contract before you sign it. This file is general information, not legal advice.",
    "",
  );
  return out.join("\n");
}
