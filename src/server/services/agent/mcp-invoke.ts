// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Runs an MCP tool by calling its REST route handler in process, with the
 * caller's Authorization header. Nothing is reimplemented here: the route
 * does the authentication, scopes, limits, credits and answer.
 */

import { NextRequest } from "next/server";
import type { McpToolDef } from "./mcp-tools";
import type { ToolInvoker } from "./mcp-protocol";

import { GET as contractTypesGET } from "@/app/api/v1/agent/contract-types/route";
import { POST as contractsPOST } from "@/app/api/v1/agent/contracts/route";
import { GET as templatesGET } from "@/app/api/v1/agent/templates/route";
import { GET as templateGET } from "@/app/api/v1/agent/templates/[contractType]/route";
import { POST as playbooksPOST } from "@/app/api/v1/agent/playbooks/route";
import { POST as negotiatePOST } from "@/app/api/v1/agent/negotiate/route";
import { POST as joinPOST } from "@/app/api/v1/agent/negotiate/join/route";
import { GET as dealGET, DELETE as dealDELETE } from "@/app/api/v1/agent/deals/[id]/route";
import { GET as pdfGET } from "@/app/api/v1/agent/deals/[id]/document/route";
import { GET as docxGET } from "@/app/api/v1/agent/deals/[id]/document/docx/route";
import { GET as txtGET } from "@/app/api/v1/agent/deals/[id]/document/txt/route";
import { GET as mdGET } from "@/app/api/v1/agent/deals/[id]/document/md/route";
import { GET as htmlGET } from "@/app/api/v1/agent/deals/[id]/document/html/route";
import { POST as checkoutPOST } from "@/app/api/v1/agent/credits/checkout/route";
import { GET as balanceGET } from "@/app/api/v1/agent/credits/balance/route";
import { GET as subscriptionsGET } from "@/app/api/v1/agent/subscriptions/route";

const API = "http://internal/api/v1/agent";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function request(
  path: string,
  authorization: string | null,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: unknown; idempotencyKey?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (authorization) headers.set("Authorization", authorization);
  if (opts.idempotencyKey) headers.set("Idempotency-Key", opts.idempotencyKey);
  if (opts.body !== undefined) headers.set("Content-Type", "application/json");
  return new NextRequest(`${API}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

export const invokeTool: ToolInvoker = async (tool: McpToolDef, args, authorization) => {
  switch (tool.name) {
    case "list_contract_types": {
      const lang = str(args.lang) === "es" ? "es" : "en";
      return contractTypesGET(request(`/contract-types?lang=${lang}`, authorization));
    }
    case "generate_contract": {
      // Agents read text best: the contract comes back as Markdown unless asked otherwise.
      const { idempotencyKey, ...rest } = args;
      const body = { inline: "md", ...rest };
      return contractsPOST(
        request("/contracts", authorization, {
          method: "POST",
          body,
          idempotencyKey: str(idempotencyKey) || undefined,
        }),
      );
    }
    case "list_templates": {
      const q = str(args.query);
      return templatesGET(request(q ? `/templates?q=${encodeURIComponent(q)}` : "/templates", authorization));
    }
    case "get_template": {
      const contractType = str(args.contractType);
      return templateGET(
        request(`/templates/${encodeURIComponent(contractType)}`, authorization),
        params({ contractType }),
      );
    }
    case "create_playbook":
      return playbooksPOST(request("/playbooks", authorization, { method: "POST", body: args }));
    case "initiate_negotiation":
      return negotiatePOST(request("/negotiate", authorization, { method: "POST", body: args }));
    case "join_negotiation":
      return joinPOST(request("/negotiate/join", authorization, { method: "POST", body: args }));
    case "get_deal": {
      const id = str(args.dealId);
      return dealGET(request(`/deals/${encodeURIComponent(id)}`, authorization), params({ id }));
    }
    case "delete_deal": {
      const id = str(args.dealId);
      return dealDELETE(
        request(`/deals/${encodeURIComponent(id)}`, authorization, { method: "DELETE" }),
        params({ id }),
      );
    }
    case "download_contract": {
      const id = str(args.dealId);
      const format = str(args.format) || "md";
      const handlers = { pdf: pdfGET, docx: docxGET, txt: txtGET, md: mdGET, html: htmlGET } as const;
      const handler = handlers[format as keyof typeof handlers] ?? mdGET;
      const suffix = format === "pdf" ? "" : `/${format in handlers ? format : "md"}`;
      return handler(request(`/deals/${encodeURIComponent(id)}/document${suffix}`, authorization), params({ id }));
    }
    case "buy_credits":
      return checkoutPOST(request("/credits/checkout", authorization, { method: "POST", body: args }));
    case "get_credit_balance":
      return balanceGET(request("/credits/balance", authorization));
    case "get_subscriptions":
      return subscriptionsGET(request("/subscriptions", authorization));
    default:
      return new Response(JSON.stringify({ error: `Unknown tool: ${tool.name}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
  }
};
