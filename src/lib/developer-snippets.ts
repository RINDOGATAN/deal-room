// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Copy-paste setup for the developer quick start: one snippet per MCP
 * client and the REST calls, each with the real address and a placeholder
 * for the key. Kept apart from the page so a test can check that every
 * snippet carries the address and the header.
 */

import { SITE_URL } from "./contract-pages-paths";

export const MCP_URL = `${SITE_URL}/api/v1/agent/mcp`;
export const API_BASE = `${SITE_URL}/api/v1/agent`;
export const KEY_PLACEHOLDER = "drk_YOUR_KEY";

const json = (value: unknown) => JSON.stringify(value, null, 2);

export type SnippetId = "claudeCode" | "claudeDesktop" | "cursor" | "vscode" | "generic";

export const MCP_SNIPPETS: Record<SnippetId, string> = {
  claudeCode: `claude mcp add --transport http dealroom ${MCP_URL} \\\n  --header "Authorization: Bearer ${KEY_PLACEHOLDER}"`,
  claudeDesktop: json({
    mcpServers: {
      dealroom: {
        command: "npx",
        args: ["-y", "mcp-remote", MCP_URL, "--header", "Authorization:${DEALROOM_AUTH}"],
        env: { DEALROOM_AUTH: `Bearer ${KEY_PLACEHOLDER}` },
      },
    },
  }),
  cursor: json({
    mcpServers: {
      dealroom: {
        url: MCP_URL,
        headers: { Authorization: `Bearer ${KEY_PLACEHOLDER}` },
      },
    },
  }),
  vscode: json({
    inputs: [{ type: "promptString", id: "dealroom-key", description: "Dealroom API key", password: true }],
    servers: {
      dealroom: {
        type: "http",
        url: MCP_URL,
        headers: { Authorization: "Bearer ${input:dealroom-key}" },
      },
    },
  }),
  generic: json({
    mcpServers: {
      dealroom: {
        type: "http",
        url: MCP_URL,
        headers: { Authorization: `Bearer ${KEY_PLACEHOLDER}` },
      },
    },
  }),
};

/** The example body of the one call, in the page's language. */
export function generateBody(locale: "en" | "es") {
  const es = locale === "es";
  return {
    contractType: "NDA",
    governingLaw: es ? "SPAIN" : "CALIFORNIA",
    language: locale,
    party: {
      legalName: es ? "Tu Empresa, S.L." : "Your Company, Inc.",
      signatoryName: es ? "Ana García" : "Alex Smith",
      signatoryTitle: es ? "Administradora única" : "CEO",
      email: es ? "ana@tuempresa.example" : "alex@yourcompany.example",
    },
    counterparty: { legalName: es ? "Otra Empresa, S.A." : "Other Company, LLC" },
  };
}

export function curlGenerate(locale: "en" | "es"): string {
  return [
    `curl -X POST ${API_BASE}/contracts \\`,
    `  -H "Authorization: Bearer ${KEY_PLACEHOLDER}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: $(uuidgen)" \\`,
    `  -d '${json(generateBody(locale)).replace(/\n/g, "\n  ")}'`,
  ].join("\n");
}

export function curlListTypes(locale: "en" | "es"): string {
  return `curl ${API_BASE}/contract-types${locale === "es" ? "?lang=es" : ""}`;
}

/** The shape of a successful answer (values are examples). */
export function exampleAnswer(locale: "en" | "es"): string {
  const body = generateBody(locale);
  return json({
    dealId: "cm9abc123",
    dealRoomId: "cm9def456",
    status: "AGREED",
    contractType: body.contractType,
    governingLaw: body.governingLaw,
    language: body.language,
    paid: "credit",
    dealUrl: `${SITE_URL}/deals/cm9def456`,
    documents: {
      pdf: `${API_BASE}/deals/cm9abc123/document`,
      docx: `${API_BASE}/deals/cm9abc123/document/docx`,
      txt: `${API_BASE}/deals/cm9abc123/document/txt`,
    },
    guide: `${SITE_URL}/contracts/nda`,
  });
}
