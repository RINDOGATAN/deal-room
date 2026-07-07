// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent Negotiation Orchestrator
 *
 * Called when the respondent joins an agent deal. Runs:
 * 1. Red line check
 * 2. Create DealRoom + Selections
 * 3. Run compromise engine
 * 4. Red line validation of suggestions
 * 5. Finalize agreement
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import {
  DealRoomStatus,
  GoverningLaw,
  PartyRole,
  PartyStatus,
  ClauseStatus,
  type PlaybookEntry,
  type AgentDealRoom,
} from "@prisma/client";
import {
  calculateCompromise,
  globalFairnessPass,
  type OptionInput,
} from "../compromise/engine";
import {
  checkRedLines,
  validateSuggestionAgainstRedLines,
} from "./redlines";
import { fireWebhook } from "./webhooks";

const logger = createLogger("agent-negotiator");

async function recordNegotiationUsage(
  agentDealRoom: {
    id: string;
    initiatorCustomerId: string;
    respondentCustomerId: string | null;
    contractType: string;
    governingLaw: GoverningLaw;
  },
  outcome: "AGREED" | "FAILED"
) {
  // Find skill package for this contract type
  const template = await prisma.contractTemplate.findUnique({
    where: { contractType: agentDealRoom.contractType },
    select: { skillPackageId: true },
  });

  const usageRecords = [
    {
      customerId: agentDealRoom.initiatorCustomerId,
      skillPackageId: template?.skillPackageId || null,
      agentDealRoomId: agentDealRoom.id,
      contractType: agentDealRoom.contractType,
      governingLaw: agentDealRoom.governingLaw,
      outcome,
    },
  ];

  // Record for respondent too if present
  if (agentDealRoom.respondentCustomerId) {
    usageRecords.push({
      customerId: agentDealRoom.respondentCustomerId,
      skillPackageId: template?.skillPackageId || null,
      agentDealRoomId: agentDealRoom.id,
      contractType: agentDealRoom.contractType,
      governingLaw: agentDealRoom.governingLaw,
      outcome,
    });
  }

  await prisma.negotiationUsage.createMany({ data: usageRecords });
}

export interface NegotiationResult {
  status: "AGREED" | "FAILED";
  agentDealRoomId: string;
  dealRoomId?: string;
  failureReason?: string;
  conflicts?: Array<{
    clauseId: string;
    reason: string;
  }>;
  clauses?: Array<{
    clauseId: string;
    clauseTitle: string;
    agreedOptionId: string;
    agreedOptionLabel: string;
    satisfactionInitiator: number;
    satisfactionRespondent: number;
    reasoning: string;
  }>;
  overallSatisfaction?: {
    initiator: number;
    respondent: number;
  };
  negotiationLog?: Record<string, unknown>;
}

/**
 * Run the full agent negotiation process.
 */
export async function runNegotiation(
  agentDealRoom: AgentDealRoom & {
    initiatorPlaybook: { entries: PlaybookEntry[] };
    respondentPlaybook: { entries: PlaybookEntry[] } | null;
  }
): Promise<NegotiationResult> {
  if (!agentDealRoom.respondentPlaybook) {
    throw new Error("Respondent playbook is required");
  }

  const initiatorEntries = agentDealRoom.initiatorPlaybook.entries;
  const respondentEntries = agentDealRoom.respondentPlaybook.entries;

  // ── Step 1: Red Line Check ──────────────────────────────────
  const redLineResult = checkRedLines(initiatorEntries, respondentEntries);

  if (!redLineResult.passed) {
    await prisma.agentDealRoom.update({
      where: { id: agentDealRoom.id },
      data: {
        status: "FAILED",
        failureReason: `Irreconcilable red line conflicts on ${redLineResult.conflicts.length} clause(s)`,
        negotiationLog: {
          step: "red_line_check",
          conflicts: redLineResult.conflicts,
        } as unknown as Prisma.InputJsonValue,
        resolvedAt: new Date(),
      },
    });

    recordNegotiationUsage(agentDealRoom, "FAILED").catch((err) =>
      logger.error("Failed to record negotiation usage (FAILED)", { err: String(err) })
    );

    // Fire webhook events (fire-and-forget)
    const failedData = {
      agentDealRoomId: agentDealRoom.id,
      status: "FAILED",
      failureReason: `Irreconcilable red line conflicts on ${redLineResult.conflicts.length} clause(s)`,
      conflicts: redLineResult.conflicts,
    };
    fireWebhook(agentDealRoom.initiatorCustomerId, "negotiation.failed", failedData).catch(() => {});
    if (agentDealRoom.respondentCustomerId) {
      fireWebhook(agentDealRoom.respondentCustomerId, "negotiation.failed", failedData).catch(() => {});
    }

    return {
      status: "FAILED",
      agentDealRoomId: agentDealRoom.id,
      failureReason: `Irreconcilable red line conflicts on ${redLineResult.conflicts.length} clause(s)`,
      conflicts: redLineResult.conflicts.map((c) => ({
        clauseId: c.clauseId,
        reason: c.reason,
      })),
    };
  }

  // ── Step 2: Create DealRoom + Selections ────────────────────
  // Find the contract template with clauses + options
  const template = await prisma.contractTemplate.findUnique({
    where: { contractType: agentDealRoom.contractType },
    include: {
      clauses: {
        include: {
          options: { orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!template) {
    throw new Error(`Contract template not found: ${agentDealRoom.contractType}`);
  }

  // Look up attorney attestation for this template + jurisdiction
  const attestation = await prisma.lawyerVetting.findFirst({
    where: {
      contractTemplateId: template.id,
      governingLaw: agentDealRoom.governingLaw,
      status: "APPROVED",
    },
    orderBy: { approvedAt: "desc" },
    include: {
      lawyer: {
        include: {
          lawyerProfile: true,
        },
      },
    },
  });

  let attestingBarNumber: string | null = null;
  let attestingAttorneyName: string | null = null;

  if (attestation) {
    // Look up the supervisor bar admission for this jurisdiction
    // The lawyer who approved the vetting is the attesting attorney
    attestingAttorneyName = attestation.lawyer.name || null;

    // Try to find bar number from supervisor bar admissions
    // (the vetting lawyer may also be a supervisor)
    const supervisorRecord = await prisma.supervisor.findFirst({
      where: { email: attestation.lawyer.email },
      include: {
        barAdmissions: {
          where: { jurisdiction: agentDealRoom.governingLaw },
        },
      },
    });

    if (supervisorRecord?.barAdmissions[0]) {
      attestingBarNumber = supervisorRecord.barAdmissions[0].barNumber;
    }
  }

  // Index playbook entries by clauseId
  const initEntryMap = new Map<string, PlaybookEntry>();
  for (const e of initiatorEntries) initEntryMap.set(e.clauseId, e);
  const respEntryMap = new Map<string, PlaybookEntry>();
  for (const e of respondentEntries) respEntryMap.set(e.clauseId, e);

  // Create the DealRoom
  const dealRoom = await prisma.dealRoom.create({
    data: {
      name: agentDealRoom.dealName,
      contractTemplateId: template.id,
      governingLaw: agentDealRoom.governingLaw,
      contractLanguage: agentDealRoom.contractLanguage,
      status: DealRoomStatus.NEGOTIATING,
      parties: {
        createMany: {
          data: [
            {
              role: PartyRole.INITIATOR,
              status: PartyStatus.SUBMITTED,
              email: agentDealRoom.initiatorEmail,
              company: agentDealRoom.initiatorCompany,
              submittedAt: new Date(),
            },
            {
              role: PartyRole.RESPONDENT,
              status: PartyStatus.SUBMITTED,
              email: agentDealRoom.respondentEmail!,
              company: agentDealRoom.respondentCompany,
              submittedAt: new Date(),
            },
          ],
        },
      },
      clauses: {
        create: template.clauses.map((clause) => ({
          clauseTemplateId: clause.id,
          status: ClauseStatus.PENDING,
        })),
      },
    },
    include: {
      parties: true,
      clauses: {
        include: {
          clauseTemplate: {
            include: {
              options: { orderBy: { order: "asc" } },
            },
          },
        },
        orderBy: { clauseTemplate: { order: "asc" } },
      },
    },
  });

  const initiatorParty = dealRoom.parties.find(
    (p) => p.role === PartyRole.INITIATOR
  )!;
  const respondentParty = dealRoom.parties.find(
    (p) => p.role === PartyRole.RESPONDENT
  )!;

  // Create PartySelections from playbook entries
  const selectionData: Array<{
    dealRoomClauseId: string;
    partyId: string;
    optionId: string;
    priority: number;
    flexibility: number;
  }> = [];

  for (const clause of dealRoom.clauses) {
    const clauseId = clause.clauseTemplate.clauseId;
    const options = clause.clauseTemplate.options;

    // Initiator selection
    const initEntry = initEntryMap.get(clauseId);
    if (initEntry) {
      const option = options.find((o) => o.code === initEntry.preferredOptionId);
      if (option) {
        selectionData.push({
          dealRoomClauseId: clause.id,
          partyId: initiatorParty.id,
          optionId: option.id,
          priority: initEntry.priority,
          flexibility: initEntry.flexibility,
        });
      }
    }

    // Respondent selection
    const respEntry = respEntryMap.get(clauseId);
    if (respEntry) {
      const option = options.find((o) => o.code === respEntry.preferredOptionId);
      if (option) {
        selectionData.push({
          dealRoomClauseId: clause.id,
          partyId: respondentParty.id,
          optionId: option.id,
          priority: respEntry.priority,
          flexibility: respEntry.flexibility,
        });
      }
    }
  }

  // Bulk-create selections
  await prisma.partySelection.createMany({ data: selectionData });

  // Build a selection lookup: { dealRoomClauseId -> { partyId -> selection } }
  const selectionLookup = new Map<
    string,
    Map<string, (typeof selectionData)[0]>
  >();
  for (const sel of selectionData) {
    if (!selectionLookup.has(sel.dealRoomClauseId)) {
      selectionLookup.set(sel.dealRoomClauseId, new Map());
    }
    selectionLookup.get(sel.dealRoomClauseId)!.set(sel.partyId, sel);
  }

  // ── Step 3: Run Compromise Engine ──────────────────────────
  const negotiationLog: Record<string, unknown> = {};
  const compromiseInputs: Array<{
    clauseId: string;
    dealRoomClauseId: string;
    clauseTitle: string;
    result: ReturnType<typeof calculateCompromise>;
    options: OptionInput[];
    partyAOptionOrder: number;
    partyBOptionOrder: number;
    initEntry: PlaybookEntry | undefined;
    respEntry: PlaybookEntry | undefined;
  }> = [];

  for (const clause of dealRoom.clauses) {
    const clauseId = clause.clauseTemplate.clauseId;
    const options: OptionInput[] = clause.clauseTemplate.options.map((o) => ({
      id: o.id,
      order: o.order,
      label: o.label,
      biasPartyA: o.biasPartyA,
      biasPartyB: o.biasPartyB,
    }));

    const clauseSelections = selectionLookup.get(clause.id);
    const initSel = clauseSelections?.get(initiatorParty.id);
    const respSel = clauseSelections?.get(respondentParty.id);

    if (!initSel || !respSel) {
      // If one side doesn't have a selection for this clause, skip compromise
      // and mark as agreed with whichever side has a selection
      const agreedOptionId = initSel?.optionId || respSel?.optionId;
      if (agreedOptionId) {
        await prisma.dealRoomClause.update({
          where: { id: clause.id },
          data: { status: ClauseStatus.AGREED, agreedOptionId },
        });
      }
      continue;
    }

    // Both parties selected the same option → auto-agree
    if (initSel.optionId === respSel.optionId) {
      await prisma.dealRoomClause.update({
        where: { id: clause.id },
        data: { status: ClauseStatus.AGREED, agreedOptionId: initSel.optionId },
      });

      const opt = options.find((o) => o.id === initSel.optionId);
      negotiationLog[clauseId] = {
        outcome: "auto-agreed",
        optionId: initSel.optionId,
        optionLabel: opt?.label,
      };
      continue;
    }

    // Divergent: run compromise
    const initOption = options.find((o) => o.id === initSel.optionId)!;
    const respOption = options.find((o) => o.id === respSel.optionId)!;

    const result = calculateCompromise({
      partyASelection: {
        optionId: initSel.optionId,
        priority: initSel.priority,
        flexibility: initSel.flexibility,
        biasPartyA: initOption.biasPartyA,
        biasPartyB: initOption.biasPartyB,
      },
      partyBSelection: {
        optionId: respSel.optionId,
        priority: respSel.priority,
        flexibility: respSel.flexibility,
        biasPartyA: respOption.biasPartyA,
        biasPartyB: respOption.biasPartyB,
      },
      options,
      clauseTitle: clause.clauseTemplate.title,
    });

    compromiseInputs.push({
      clauseId,
      dealRoomClauseId: clause.id,
      clauseTitle: clause.clauseTemplate.title,
      result,
      options,
      partyAOptionOrder: initOption.order,
      partyBOptionOrder: respOption.order,
      initEntry: initEntryMap.get(clauseId),
      respEntry: respEntryMap.get(clauseId),
    });
  }

  // Global fairness pass
  let finalResults = compromiseInputs;
  if (compromiseInputs.length > 0) {
    const fairnessAdjusted = globalFairnessPass(
      compromiseInputs.map((c) => ({
        clauseId: c.clauseId,
        result: c.result,
        options: c.options,
        partyAOptionOrder: c.partyAOptionOrder,
        partyBOptionOrder: c.partyBOptionOrder,
      }))
    );

    // Merge fairness results back
    finalResults = compromiseInputs.map((c, i) => ({
      ...c,
      result: fairnessAdjusted[i].result,
    }));
  }

  // ── Step 4: Red Line Validation of Suggestions ──────────────
  const resultClauses: NegotiationResult["clauses"] = [];

  for (const item of finalResults) {
    const allOptionIds = item.options.map((o) => o.id);
    const validatedOptionId = validateSuggestionAgainstRedLines(
      item.result.suggestedOptionId,
      item.initEntry,
      item.respEntry,
      allOptionIds
    );

    // If validation changed the option, recalculate satisfaction
    let finalResult = item.result;
    if (validatedOptionId !== item.result.suggestedOptionId) {
      finalResult = {
        ...item.result,
        suggestedOptionId: validatedOptionId,
        reasoning:
          item.result.reasoning +
          " (Adjusted to respect red line constraints.)",
      };
    }

    // Update DealRoomClause
    await prisma.dealRoomClause.update({
      where: { id: item.dealRoomClauseId },
      data: {
        status: ClauseStatus.AGREED,
        agreedOptionId: finalResult.suggestedOptionId,
      },
    });

    // Create compromise suggestion record
    await prisma.compromiseSuggestion.create({
      data: {
        dealRoomClauseId: item.dealRoomClauseId,
        roundNumber: 1,
        suggestedOptionId: finalResult.suggestedOptionId,
        satisfactionPartyA: finalResult.satisfactionPartyA,
        satisfactionPartyB: finalResult.satisfactionPartyB,
        reasoning: finalResult.reasoning,
        partyAAccepted: true,
        partyBAccepted: true,
      },
    });

    const agreedOption = item.options.find(
      (o) => o.id === finalResult.suggestedOptionId
    );

    resultClauses.push({
      clauseId: item.clauseId,
      clauseTitle: item.clauseTitle,
      agreedOptionId: finalResult.suggestedOptionId,
      agreedOptionLabel: agreedOption?.label || "Unknown",
      satisfactionInitiator: finalResult.satisfactionPartyA,
      satisfactionRespondent: finalResult.satisfactionPartyB,
      reasoning: finalResult.reasoning,
    });

    negotiationLog[item.clauseId] = {
      outcome: "compromised",
      suggestedOptionId: finalResult.suggestedOptionId,
      suggestedOptionLabel: agreedOption?.label,
      satisfactionInitiator: finalResult.satisfactionPartyA,
      satisfactionRespondent: finalResult.satisfactionPartyB,
      reasoning: finalResult.reasoning,
    };
  }

  // ── Step 5: Finalize ────────────────────────────────────────
  // Update DealRoom status
  await prisma.dealRoom.update({
    where: { id: dealRoom.id },
    data: { status: DealRoomStatus.AGREED },
  });

  // Calculate overall satisfaction
  const allSatisfactions = resultClauses.length > 0
    ? {
        initiator:
          Math.round(
            resultClauses.reduce(
              (sum, c) => sum + c.satisfactionInitiator,
              0
            ) / resultClauses.length
          ),
        respondent:
          Math.round(
            resultClauses.reduce(
              (sum, c) => sum + c.satisfactionRespondent,
              0
            ) / resultClauses.length
          ),
      }
    : { initiator: 100, respondent: 100 };

  // Update AgentDealRoom
  await prisma.agentDealRoom.update({
    where: { id: agentDealRoom.id },
    data: {
      status: "AGREED",
      dealRoomId: dealRoom.id,
      negotiationLog: negotiationLog as unknown as Prisma.InputJsonValue,
      resolvedAt: new Date(),
      attestingBarNumber,
      attestingAttorneyName,
    },
  });

  recordNegotiationUsage(agentDealRoom, "AGREED").catch((err) =>
    logger.error("Failed to record negotiation usage (AGREED)", { err: String(err) })
  );

  // Fire webhook events (fire-and-forget)
  const webhookData = {
    agentDealRoomId: agentDealRoom.id,
    dealRoomId: dealRoom.id,
    status: "AGREED",
    contractType: agentDealRoom.contractType,
    governingLaw: agentDealRoom.governingLaw,
    dealName: agentDealRoom.dealName,
  };
  fireWebhook(agentDealRoom.initiatorCustomerId, "negotiation.agreed", webhookData).catch(() => {});
  if (agentDealRoom.respondentCustomerId) {
    fireWebhook(agentDealRoom.respondentCustomerId, "negotiation.agreed", webhookData).catch(() => {});
  }

  return {
    status: "AGREED",
    agentDealRoomId: agentDealRoom.id,
    dealRoomId: dealRoom.id,
    clauses: resultClauses,
    overallSatisfaction: allSatisfactions,
    negotiationLog,
  };
}
