// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import type { PageLocale } from "@/lib/contract-pages-paths";
import { MCP_URL, agentContractType, developersMcpPath, mustSendInputs, oneCallCurl } from "@/lib/agent-discovery";
import { CodeBlock } from "@/components/developers/CodeBlock";
import { CONTRACT_COPY, JURISDICTION_NAMES } from "./copy";

/**
 * "Make this contract from your AI agent": the same short block on every
 * guide, near the top, with this contract's code, its required inputs,
 * the MCP server address and the one call pre-filled for it.
 */
export function AgentBlock({ contractType, locale }: { contractType: string; locale: PageLocale }) {
  const copy = CONTRACT_COPY[locale];
  const inputs = mustSendInputs(agentContractType(contractType)).map((i) =>
    i.onlyUnder?.length
      ? `${i.id} (${copy.agentOnlyUnder(i.onlyUnder.map((l) => JURISDICTION_NAMES[l]?.[locale] ?? l).join(", "))})`
      : i.id,
  );

  return (
    <section id="agent" aria-labelledby="agent-title" className="mt-8 border border-border rounded-lg bg-card p-5 scroll-mt-24">
      <h2 id="agent-title" className="text-lg font-semibold flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" aria-hidden />
        {copy.agentTitle}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.agentText}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{copy.agentCode}</dt>
        <dd>
          <code className="font-semibold">{contractType}</code>
        </dd>
        <dt className="text-muted-foreground">{copy.agentInputs}</dt>
        <dd>
          {inputs.length === 0 ? (
            copy.agentInputsNone
          ) : (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {inputs.map((i) => (
                <code key={i} className="text-xs break-words">
                  {i}
                </code>
              ))}
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground">{copy.agentServer}</dt>
        <dd>
          <code className="text-xs break-all">{MCP_URL}</code>
        </dd>
      </dl>
      <CodeBlock code={oneCallCurl(contractType, locale)} locale={locale} label={copy.agentCallLabel} />
      <Link
        href={developersMcpPath(locale)}
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {copy.agentSetup}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </section>
  );
}
