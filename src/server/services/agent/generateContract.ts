// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One call, one contract: POST /api/v1/agent/contracts and the MCP tool
 * `generate_contract`.
 *
 * It strings together what an agent otherwise does in several calls, with
 * the same services and the same rules:
 *   1. reads the contract type (code or guide slug) and checks the
 *      governing law and language against the catalogue;
 *   2. with billing on, refuses up front (HTTP 402, nothing created) when
 *      the customer holds no credit;
 *   3. creates an agreed SOLO deal through the solo fact intake
 *      (`createSoloDealFromFacts`), filling every clause the caller leaves
 *      out with the skill's baseline option;
 *   4. pays for it exactly as the first document download does
 *      (`dealAccessForAgent`: one credit, or nothing where billing is off);
 *   5. returns the deal, the document links and, on request, the contract
 *      itself in an agent-readable format (Markdown, HTML or plain text).
 *
 * There is no free path: a contract made here costs what a contract
 * downloaded through /deals/:id/document costs, and later downloads of the
 * same deal are free there too.
 */

import { z } from "zod";
import type { Customer } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { partyDetailsSchema } from "@/lib/solo-counterparty";
import { createSoloDealFromFacts } from "@/server/services/agent/soloIntake";
import {
  A2A_PREFIX,
  contractTypeFromInput,
  isPlaceholderContractType,
  governingLawsFor,
  slugForContractType,
} from "@/server/services/agent/contractTypes";
import { dealAccessForAgent } from "@/server/services/billing/deal-entitlement";
import { AGENT_PAYMENT_REQUIRED_MESSAGE } from "@/lib/contract-billing";
import { generateContractData } from "@/server/services/document/generator";
import { generateContractTxt } from "@/server/services/document/contractTxt";
import { generateContractMarkdown } from "@/server/services/document/contractMarkdown";
import { generateContractHtml } from "@/server/services/document/contractHtml";
import type { ParameterSchema } from "@/lib/parameters";
import { LIVE_ROWS } from "@/lib/clause-retirement";

export const generateContractSchema = z.object({
  contractType: z.string().trim().min(1).max(100),
  governingLaw: z.string().trim().min(1).max(40).optional(),
  language: z.string().trim().min(2).max(5).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  party: partyDetailsSchema,
  counterparty: partyDetailsSchema.optional(),
  role: z.string().trim().min(1).max(40).optional(),
  terms: z.record(z.string(), z.string().max(10_000)).optional(),
  clauses: z.record(z.string(), z.string().max(200)).optional(),
  /** Return the contract in the answer: Markdown, HTML or plain text. */
  inline: z.enum(["md", "html", "txt"]).optional(),
});

export type GenerateContractInput = z.infer<typeof generateContractSchema>;

export interface GenerateAuth {
  customer: Pick<Customer, "id" | "name" | "email">;
  apiKey: { id: string };
}

export type GenerateContractResult =
  | { ok: true; status: 201; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

function fail(status: number, error: string, extra: Record<string, unknown> = {}): GenerateContractResult {
  return { ok: false, status, body: { error, ...extra } };
}

const CONTRACT_TYPES_HINT = "GET /api/v1/agent/contract-types lists every contract type and what it needs.";

function paymentRequired(extra: Record<string, unknown> = {}): GenerateContractResult {
  return fail(402, AGENT_PAYMENT_REQUIRED_MESSAGE, {
    code: "PAYMENT_REQUIRED",
    checkout: { method: "POST", url: "/api/v1/agent/credits/checkout" },
    balance: { method: "GET", url: "/api/v1/agent/credits/balance" },
    ...extra,
  });
}

/** The caller's inputs plus the default of every input it left out (under this law). */
export function withDefaults(
  terms: Record<string, string>,
  schema: ParameterSchema | null | undefined,
  governingLaw: string,
): Record<string, string> {
  const out = { ...terms };
  for (const p of schema?.parameters ?? []) {
    if (p.jurisdictions?.length && !p.jurisdictions.includes(governingLaw)) continue;
    if (p.default !== undefined && p.default !== "" && !out[p.id]?.trim()) out[p.id] = p.default;
  }
  return out;
}

function defaultTitle(name: string, input: GenerateContractInput): string {
  const between = input.counterparty
    ? `${input.party.legalName} and ${input.counterparty.legalName}`
    : input.party.legalName;
  return `${name} (${between})`.slice(0, 200);
}

export async function generateContract(
  prisma: ExtendedPrismaClient,
  auth: GenerateAuth,
  input: GenerateContractInput,
): Promise<GenerateContractResult> {
  // 1. The contract type, governing law and language.
  const catalogue = await prisma.contractTemplate.findMany({
    where: { isActive: true },
    select: {
      contractType: true,
      displayName: true,
      jurisdictions: true,
      languages: true,
      parameterSchema: true,
      _count: { select: { clauses: { where: LIVE_ROWS } } },
    },
  });
  // A template without clauses (a catalogue-only stub) cannot make a
  // contract, and the placeholder template is not a contract at all.
  const usable = catalogue.filter(
    (t) => (t._count?.clauses ?? 1) > 0 && !isPlaceholderContractType(t.contractType),
  );
  const contractType = contractTypeFromInput(
    input.contractType,
    usable.map((t) => t.contractType),
  );
  if (!contractType) {
    return fail(404, `Unknown contract type: ${input.contractType}`, { hint: CONTRACT_TYPES_HINT });
  }
  if (contractType.startsWith(A2A_PREFIX)) {
    return fail(422, `${contractType} is an agent-to-agent protocol; negotiate it with POST /api/v1/agent/negotiate.`);
  }
  const template = usable.find((t) => t.contractType === contractType)!;

  const laws = governingLawsFor(template.jurisdictions);
  let governingLaw = input.governingLaw?.toUpperCase();
  if (!governingLaw) {
    if (laws.length !== 1) {
      return fail(422, `governingLaw is required for ${contractType}`, { allowed: laws });
    }
    governingLaw = laws[0];
  } else if (laws.length > 0 && !laws.includes(governingLaw as (typeof laws)[number])) {
    return fail(422, `Governing law ${governingLaw} is not offered by ${contractType}`, { allowed: laws });
  }

  const language =
    input.language ?? (template.languages.length === 0 || template.languages.includes("en") ? "en" : template.languages[0]);

  // Inputs left out take their default, as the wizard pre-fills them;
  // required inputs without a default must still be sent.
  const terms = withDefaults(
    input.terms ?? {},
    template.parameterSchema as unknown as ParameterSchema | null,
    governingLaw,
  );

  // 2. No credit, no contract: refuse before anything is created.
  if (features.stripeEnabled) {
    const credit = await prisma.customerCredit.findUnique({
      where: { customerId: auth.customer.id },
      select: { balance: true },
    });
    if (!credit || credit.balance < 1) return paymentRequired();
  }

  // The person behind the account (the customer's e-mail, the same link
  // Settings, API keys uses) becomes the deal's party, so the deal opens
  // for them in the browser.
  const owner = await prisma.user.findFirst({
    where: { email: { equals: auth.customer.email, mode: "insensitive" } },
    select: { id: true },
  });

  // 3. The agreed SOLO deal.
  const created = await createSoloDealFromFacts(prisma, auth.customer, {
    contractType,
    governingLaw,
    language,
    dealName: input.title ?? defaultTitle(template.displayName, input),
    initiatorEmail: input.party.email,
    initiatorCompany: input.party.legalName,
    fillRole: input.role?.toUpperCase(),
    parameters: terms,
    selections: input.clauses,
    selectionPolicy: "defaults",
    initiatorDetails: input.party,
    counterparty: input.counterparty,
    initiatorUserId: owner?.id,
  });
  if (!created.ok) {
    return fail(created.status, created.error, {
      ...(created.details ? { details: created.details } : {}),
      ...(created.status === 404 ? { hint: CONTRACT_TYPES_HINT } : {}),
    });
  }

  const base = `https://${brand.appDomain}`;
  const api = `${base}/api/v1/agent/deals/${created.agentDealRoomId}`;
  const ids = { dealId: created.agentDealRoomId, dealRoomId: created.dealRoomId };

  if (created.status !== "AGREED") {
    // Every clause has a baseline, so this means a clause had no option
    // available under the chosen law. Nothing was charged.
    return fail(422, "Some clauses could not be settled; nothing was charged", {
      ...ids,
      unresolvedClauseIds: created.unresolvedClauseIds,
    });
  }

  // 4. Pay exactly as the first document download does.
  const access = await dealAccessForAgent(created.dealRoomId, {
    apiKeyId: auth.apiKey.id,
    customerId: auth.customer.id,
  });
  if (!access.paid) {
    return paymentRequired({
      ...ids,
      retry: `GET ${api}/document once you hold a credit`,
    });
  }

  // 5. The answer.
  let inline: { format: string; content: string } | undefined;
  if (input.inline) {
    const data = await generateContractData(created.dealRoomId);
    if (data) {
      const render = { md: generateContractMarkdown, html: generateContractHtml, txt: generateContractTxt }[input.inline];
      inline = { format: input.inline, content: render(data) };
    }
  }

  const slug = slugForContractType(contractType);
  return {
    ok: true,
    status: 201,
    body: {
      ...ids,
      status: "AGREED",
      contractType,
      governingLaw,
      language,
      paid: access.via,
      // Opens for the person whose e-mail owns the API key, once signed in.
      dealUrl: owner ? `${base}/deals/${created.dealRoomId}` : null,
      ...(owner
        ? {}
        : {
            dealUrlNote:
              "No Dealroom account uses the e-mail of this API key's customer, so this deal has no browser link. Deals made after you sign in once with that e-mail will have one.",
          }),
      documents: {
        pdf: `${api}/document`,
        docx: `${api}/document/docx`,
        txt: `${api}/document/txt`,
        md: `${api}/document/md`,
        html: `${api}/document/html`,
      },
      guide: slug ? `${base}/contracts/${slug}` : null,
      ...(inline ? { document: inline } : {}),
    },
  };
}
