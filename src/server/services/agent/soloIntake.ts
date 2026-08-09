// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent solo intake — create an agreed SOLO deal from a fact package.
 *
 * The seam between Dealroom and the rest of the suite (DPO Central in
 * particular): the caller holds the understanding of a customer's stack
 * (sub-processors, hosting regions, data categories, evidenced controls)
 * and submits it as FACTS; Dealroom holds the contract know-how and turns
 * those facts into the agreed document set (DPA + TIA + annexes). Nothing
 * about drafting crosses the boundary in either direction.
 *
 * Selections address clauses by their authored skill-level ids and options
 * by authored optionId or code (never DB cuids), so packages survive
 * reseeds. With selectionPolicy "defaults", unspecified multi-option
 * clauses fall back to the lowest-ordered option available in the deal's
 * jurisdiction — the skill's baseline. Unknown clause ids and options that
 * do not exist or are unavailable in the jurisdiction fail the intake
 * loudly rather than silently drifting the document.
 */

import { randomBytes } from "crypto";
import {
  DealMode,
  DealRoomStatus,
  PartyRole,
  PartyStatus,
  ClauseStatus,
  GoverningLaw,
} from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { applyPresetSelections } from "@/server/services/deal/applyPreset";
import { roleConfigFor } from "@/lib/contractRoles";
import {
  validateRequiredParameters,
  type ParameterSchema,
} from "@/lib/parameters";

export interface SoloIntakeInput {
  contractType: string;
  governingLaw: string;
  language?: string;
  dealName: string;
  initiatorEmail?: string;
  initiatorCompany?: string;
  /** Asymmetric-role contracts (DPA/BAA): which role the caller fills. */
  fillRole?: string;
  parameters?: Record<string, string>;
  /** clauseId (as authored in the skill) → optionId or option code. */
  selections?: Record<string, string>;
  /** "defaults" fills unspecified clauses with the skill baseline;
   *  "explicit" (default) leaves them unresolved and reports them. */
  selectionPolicy?: "explicit" | "defaults";
}

export type SoloIntakeResult =
  | {
      ok: true;
      agentDealRoomId: string;
      dealRoomId: string;
      status: "AGREED" | "NEGOTIATING";
      unresolvedClauseIds: string[];
    }
  | { ok: false; status: number; error: string; details?: unknown };

interface OptionRow {
  id: string;
  optionId: string;
  code: string;
  order: number;
  jurisdictionConfig: unknown;
}

function availableInJurisdiction(opt: OptionRow, governingLaw: string): boolean {
  const cfg = opt.jurisdictionConfig as Record<string, { available?: boolean }> | null;
  return cfg?.[governingLaw]?.available !== false;
}

export async function createSoloDealFromFacts(
  prisma: ExtendedPrismaClient,
  customer: { id: string; name: string; email: string },
  input: SoloIntakeInput
): Promise<SoloIntakeResult> {
  const template = await prisma.contractTemplate.findUnique({
    where: { contractType: input.contractType },
    include: { clauses: { include: { options: { orderBy: { order: "asc" } } } } },
  });
  if (!template || !template.isActive) {
    return { ok: false, status: 404, error: `Unknown contract type: ${input.contractType}` };
  }
  if (!Object.values(GoverningLaw).includes(input.governingLaw as GoverningLaw)) {
    return { ok: false, status: 422, error: `Unknown governing law: ${input.governingLaw}` };
  }
  if (
    template.jurisdictions.length > 0 &&
    !template.jurisdictions.includes(input.governingLaw)
  ) {
    return {
      ok: false,
      status: 422,
      error: `Governing law ${input.governingLaw} is not offered by ${input.contractType}`,
    };
  }
  const language = input.language || "en";
  if (template.languages.length > 0 && !template.languages.includes(language)) {
    return { ok: false, status: 422, error: `Language ${language} is not offered by ${input.contractType}` };
  }

  // Required parameters — same rule as the wizard
  const parameterSchema = template.parameterSchema as unknown as ParameterSchema | null;
  const parameters = input.parameters ?? {};
  if (parameterSchema?.parameters?.length) {
    const missing = validateRequiredParameters(
      parameters,
      parameterSchema,
      input.governingLaw
    );
    if (missing.length > 0) {
      return {
        ok: false,
        status: 422,
        error: "Missing required parameters",
        details: { missing },
      };
    }
  }

  // Resolve selections against authored ids/codes, respecting jurisdiction
  // availability. Anything explicitly requested must resolve; policy
  // "defaults" fills the gaps, policy "explicit" reports them.
  const selections = input.selections ?? {};
  const invalid: Array<{ clauseId: string; wanted: string; reason: string }> = [];
  const presetSelections: Record<string, string> = {};
  const knownClauseIds = new Set(template.clauses.map((c) => c.clauseId));
  for (const clauseId of Object.keys(selections)) {
    if (!knownClauseIds.has(clauseId)) {
      invalid.push({ clauseId, wanted: selections[clauseId], reason: "unknown clause" });
    }
  }
  for (const clause of template.clauses) {
    const wanted = selections[clause.clauseId];
    const options = clause.options as OptionRow[];
    if (wanted) {
      const match = options.find((o) => o.optionId === wanted || o.code === wanted);
      if (!match) {
        invalid.push({ clauseId: clause.clauseId, wanted, reason: "unknown option" });
      } else if (!availableInJurisdiction(match, input.governingLaw)) {
        invalid.push({
          clauseId: clause.clauseId,
          wanted,
          reason: `option not available under ${input.governingLaw}`,
        });
      } else {
        presetSelections[clause.clauseId] = match.optionId;
      }
    } else if (input.selectionPolicy === "defaults") {
      const fallback = options.find((o) => availableInJurisdiction(o, input.governingLaw));
      if (fallback) presetSelections[clause.clauseId] = fallback.optionId;
    }
    // policy "explicit": unspecified multi-option clauses stay unresolved;
    // applyPresetSelections still auto-fills single-option clauses.
  }
  if (invalid.length > 0) {
    return { ok: false, status: 422, error: "Invalid selections", details: { invalid } };
  }

  const roleConfig = roleConfigFor(input.contractType);
  const soloFillRole = roleConfig ? input.fillRole ?? roleConfig.defaultRole : null;
  if (
    roleConfig &&
    input.fillRole &&
    !roleConfig.options.some((o) => o.role === input.fillRole)
  ) {
    return { ok: false, status: 422, error: `Unknown fillRole: ${input.fillRole}` };
  }

  const dealRoom = await prisma.dealRoom.create({
    data: {
      name: input.dealName,
      contractTemplateId: template.id,
      dealMode: DealMode.SOLO,
      governingLaw: input.governingLaw as GoverningLaw,
      contractLanguage: language,
      status: DealRoomStatus.DRAFT,
      parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
      soloFillRole,
      parties: {
        create: {
          role: PartyRole.INITIATOR,
          status: PartyStatus.PENDING,
          email: input.initiatorEmail || customer.email,
          company: input.initiatorCompany || customer.name,
        },
      },
      clauses: {
        create: template.clauses.map((clause) => ({
          clauseTemplateId: clause.id,
          status: ClauseStatus.PENDING,
        })),
      },
    },
    include: { parties: true, clauses: true },
  });

  const { agreed, unresolvedClauseIds } = await applyPresetSelections(prisma, {
    dealRoomId: dealRoom.id,
    dealMode: DealMode.SOLO,
    partyId: dealRoom.parties[0].id,
    preset: { id: "agent-intake", name: "Agent fact intake", selections: presetSelections },
    templateClauses: template.clauses,
    dealClauses: dealRoom.clauses,
  });

  const agentDealRoom = await prisma.agentDealRoom.create({
    data: {
      dealRoomId: dealRoom.id,
      negotiationToken: `nt_${randomBytes(24).toString("hex")}`,
      initiatorCustomerId: customer.id,
      status: agreed ? "AGREED" : "NEGOTIATING",
      contractType: input.contractType,
      governingLaw: input.governingLaw as GoverningLaw,
      contractLanguage: language,
      dealName: input.dealName,
      initiatorCompany: input.initiatorCompany || customer.name,
      initiatorEmail: input.initiatorEmail || customer.email,
      resolvedAt: agreed ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      dealRoomId: dealRoom.id,
      action: "AGENT_SOLO_INTAKE",
      details: {
        customerId: customer.id,
        agentDealRoomId: agentDealRoom.id,
        selectionPolicy: input.selectionPolicy ?? "explicit",
        agreed,
        unresolvedClauseIds,
      },
    },
  });

  return {
    ok: true,
    agentDealRoomId: agentDealRoom.id,
    dealRoomId: dealRoom.id,
    status: agreed ? "AGREED" : "NEGOTIATING",
    unresolvedClauseIds,
  };
}
