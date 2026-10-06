// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The discovery documents agents read before they connect: the MCP server
 * card, /.well-known/mcp.json and /llms-full.txt. Built from the same tool
 * definitions as the MCP server (`buildMcpTools`) and the same contract
 * list as the guides (`agent-discovery.ts`), without the database, so the
 * routes are prerendered.
 */

import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { CLIENT_ORDER } from "@/lib/developers-doc";
import { MCP_SNIPPETS } from "@/lib/developer-snippets";
import { CONTRACT_PAGES, loadContractPage } from "@/lib/contract-pages";
import { llmsFullText, mcpDiscovery, mcpServerCard } from "@/lib/agent-discovery";
import { buildMcpTools } from "./mcp-tools";
import { LATEST_PROTOCOL_VERSION } from "./mcp-protocol";

export function discoveryTools() {
  return buildMcpTools({
    baseUrl: `https://${brand.appDomain}/api/v1/agent`,
    stripeEnabled: features.stripeEnabled,
  });
}

export function serverCardDocument() {
  return mcpServerCard({ tools: discoveryTools(), protocolVersion: LATEST_PROTOCOL_VERSION });
}

export function mcpDiscoveryDocument() {
  return mcpDiscovery({ toolNames: discoveryTools().map((t) => t.name) });
}

export function llmsFullDocument(): string {
  const copy = DEVELOPERS_COPY.en;
  const names: Record<string, string> = {};
  for (const p of CONTRACT_PAGES) {
    const page = loadContractPage(p.slug, "en");
    names[p.contractType] = page?.heading || page?.title || p.contractType;
  }
  return llmsFullText({
    names,
    tools: copy.tools,
    snippets: CLIENT_ORDER.map((id) => ({ name: copy.clients[id].name, code: MCP_SNIPPETS[id] })),
  });
}
