// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract Document Generator Service
 *
 * Compiles deal room data into structured contract data for PDF generation.
 */

import prisma from "@/lib/prisma";
import { resolveLocalizedString } from "@/server/services/skills/i18n";
import {
  interpolateParameters,
  buildBoilerplateVariables,
  type ParameterSchema,
} from "@/lib/parameters";
import { certificationService } from "@/lib/certification-client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("doc-generator");

export interface PartyData {
  name: string;
  email: string;
  company?: string;
  legalName?: string;
  address?: string;
  taxId?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  /** Typed signature string (the name the party typed at signing). */
  signature?: string;
  /** Wall-clock timestamp the signature was recorded. */
  signedAt?: Date;
}

export interface ClauseData {
  title: string;
  category: string;
  agreedOption: string;
  legalText: string;
}

export interface Definition {
  term: string;
  definition: string;
}

export interface StandardClause {
  title: string;
  text: string;
}

export interface BoilerplateData {
  contractTitle: string;
  preamble: string;
  background?: string;
  definitions: Definition[];
  standardClauses: StandardClause[];
  generalProvisions: StandardClause[];
  jurisdictionProvision: StandardClause | null;
  jurisdictionProvisions?: StandardClause[]; // Multi-jurisdiction (e.g., Privacy Notice)
  signatureBlock: string;
  partyLabels?: { partyA: string; partyB: string };
  /** Annexes/Schedules rendered on their own pages AFTER the signature blocks (e.g. DPA Annex I/II). */
  annexes?: StandardClause[];
}

export interface CertificationData {
  ceremonyId: string;
  documentHash: string;
  certified: boolean;
  timestamps: Array<{
    partyRole: string;
    rfc3161Timestamp: string;
    signedAt: string;
    signerIp?: string;
  }>;
  verificationUrl?: string;
  auditCertificateUrl?: string;
}

export interface ContractData {
  dealName: string;
  contractType: string;
  governingLaw: string;
  governingLawKey: string;
  createdAt: Date;
  partyA: PartyData;
  partyB: PartyData | null;
  clauses: ClauseData[];
  /** Governing-law-and-jurisdiction article (negotiated forum), rendered as its
   *  own top-level article rather than under "Negotiated Terms". */
  governingLawArticle?: { title: string; text: string };
  /** Display names for the cover-page A/B slots, already reflecting the solo
   *  Controller/Processor swap. Falls back to the party objects when absent. */
  coverPartyAName?: string;
  coverPartyBName?: string;
  boilerplate: BoilerplateData | null;
  language: string;
  /** Present when document has been certified via Cloud API */
  certification?: CertificationData;
  /** Present when deal is from agent negotiation with attorney attestation */
  agentAttestation?: {
    attorneyName: string;
    barNumber: string;
    uetaPreamble: string;
    attestationFooter: string;
  };
}

const GOVERNING_LAW_DISPLAY: Record<string, Record<string, string>> = {
  CALIFORNIA: {
    en: "State of California, United States of America",
    es: "Estado de California, EE.UU.",
  },
  ENGLAND_WALES: {
    en: "England and Wales, United Kingdom",
    es: "Inglaterra y Gales, Reino Unido",
  },
  SPAIN: {
    en: "Kingdom of Spain",
    es: "Reino de España",
  },
};

/**
 * Interpolate variables in boilerplate text
 */
function interpolateText(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] || match;
  });
}

/**
 * Process boilerplate data with variable interpolation
 */
function processBoilerplate(
  rawBoilerplate: Record<string, unknown> | null,
  governingLawKey: string,
  variables: Record<string, string>,
  language: string = "en",
  multiJurisdictionKeys?: string[]
): BoilerplateData | null {
  if (!rawBoilerplate) {
    return null;
  }

  const bp = rawBoilerplate as Record<string, unknown>;

  // Helper: resolve i18n then interpolate variables
  const resolve = (val: unknown): string =>
    interpolateText(resolveLocalizedString(val, language), variables);

  // Get jurisdiction-specific provision(s)
  const jpMap = bp.jurisdictionProvisions as Record<string, Record<string, unknown>> | undefined;
  const jp = jpMap?.[governingLawKey];
  const jurisdictionProvision = jp
    ? { title: resolve(jp.title), text: resolve(jp.text) }
    : null;

  // Multi-jurisdiction support: collect provisions for all selected jurisdictions
  let multiJurisdictionProvisions: StandardClause[] | undefined;
  if (multiJurisdictionKeys && multiJurisdictionKeys.length > 0 && jpMap) {
    multiJurisdictionProvisions = multiJurisdictionKeys
      .map((key) => {
        const provision = jpMap[key];
        if (!provision) return null;
        return { title: resolve(provision.title), text: resolve(provision.text) };
      })
      .filter((p): p is StandardClause => p !== null);
  }

  const definitions = (bp.definitions as Array<Record<string, unknown>> || []).map((d) => ({
    term: resolveLocalizedString(d.term, language),
    definition: resolve(d.definition),
  }));

  const standardClauses = (bp.standardClauses as Array<Record<string, unknown>> || []).map((c) => ({
    title: resolveLocalizedString(c.title, language),
    text: resolve(c.text),
  }));

  const generalProvisions = (bp.generalProvisions as Array<Record<string, unknown>> || []).map((p) => ({
    title: resolveLocalizedString(p.title, language),
    text: resolve(p.text),
  }));

  const annexes = (bp.annexes as Array<Record<string, unknown>> || []).map((a) => ({
    title: resolveLocalizedString(a.title, language),
    text: resolve(a.text),
  }));

  const partyLabels = bp.partyLabels as Record<string, unknown> | undefined;

  return {
    contractTitle: resolve(bp.contractTitle) || "",
    preamble: resolve(bp.preamble),
    background: bp.background ? resolve(bp.background) : undefined,
    definitions,
    standardClauses,
    generalProvisions,
    jurisdictionProvision,
    jurisdictionProvisions: multiJurisdictionProvisions,
    annexes: annexes.length > 0 ? annexes : undefined,
    signatureBlock: resolve(bp.signatureBlock),
    partyLabels: partyLabels
      ? {
          partyA: resolveLocalizedString(partyLabels.partyA, language),
          partyB: resolveLocalizedString(partyLabels.partyB, language),
        }
      : undefined,
  };
}

/**
 * Fetches and compiles deal data into a structured contract format
 */
export async function generateContractData(
  dealRoomId: string
): Promise<ContractData | null> {
  const deal = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: {
      contractTemplate: true,
      parties: true,
      signingRequest: true,
      clauses: {
        include: {
          clauseTemplate: {
            include: {
              options: true,
            },
          },
          selections: {
            include: {
              option: true,
            },
          },
        },
        orderBy: {
          clauseTemplate: {
            order: "asc",
          },
        },
      },
    },
  });

  if (!deal) {
    return null;
  }

  const initiator = deal.parties.find((p) => p.role === "INITIATOR");
  const respondent = deal.parties.find((p) => p.role === "RESPONDENT");
  const isSolo = deal.dealMode === "SOLO";

  if (!initiator) {
    return null;
  }
  // respondent is null in solo mode — that's OK
  if (!respondent && !isSolo) {
    return null;
  }

  // Determine contract language
  const language = deal.contractLanguage || "en";
  const dateLocale = language === "es" ? "es-ES" : "en-US";

  // Parameter interpolation setup
  const parameterSchema = deal.contractTemplate.parameterSchema as ParameterSchema | null;
  const dealParams = (deal.parameters as Record<string, string>) || {};

  // Compile clauses with agreed options
  const clauses: ClauseData[] = [];

  // The governing-law / forum clause is negotiated (the builder picks the forum)
  // but rendered as its own top-level article, not under "Negotiated Terms" — so
  // we route it to a dedicated field instead of the clause list. Two shapes:
  //  - DPA `governing-law-jurisdiction`: options already state law + forum.
  //  - MSA/NDA/SaaS `dispute-resolution`: forum-only, so we prepend a governing
  //    law sentence built from the deal's chosen jurisdiction.
  const govLawDisplay =
    GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[language] ||
    GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
    deal.governingLaw;
  const govLawLead =
    language === "es"
      ? `El presente Acuerdo se rige e interpreta de conformidad con la legislación de ${govLawDisplay}. `
      : `This Agreement is governed by and construed in accordance with the laws of ${govLawDisplay}. `;
  let governingLawArticle: { title: string; text: string } | undefined;
  const pushClause = (entry: ClauseData, clauseId: string) => {
    if (clauseId === "governing-law-jurisdiction") {
      governingLawArticle = { title: entry.title, text: entry.legalText };
    } else if (clauseId === "dispute-resolution") {
      governingLawArticle = { title: entry.title, text: govLawLead + entry.legalText };
    } else {
      clauses.push(entry);
    }
  };

  for (const clause of deal.clauses) {
    if (clause.status !== "AGREED" || !clause.agreedOptionId) {
      continue;
    }

    // Resolve localized clause title and category
    const ctLocalized = clause.clauseTemplate.localizedContent as Record<string, Record<string, string>> | null;
    const clauseTitle = ctLocalized?.title
      ? resolveLocalizedString(ctLocalized.title, language)
      : clause.clauseTemplate.title;
    const clauseCategory = ctLocalized?.category
      ? resolveLocalizedString(ctLocalized.category, language)
      : clause.clauseTemplate.category;

    // Find the agreed option from the clause template options
    const agreedOption = clause.clauseTemplate.options.find(
      (opt) => opt.id === clause.agreedOptionId
    );

    if (!agreedOption) {
      // Fallback: try to find from selection if agreedOptionId doesn't match
      const selection = clause.selections[0];
      if (selection?.option) {
        const selLocalized = selection.option.localizedContent as Record<string, unknown> | null;
        let legalText = selLocalized?.legalText
          ? resolveLocalizedString(selLocalized.legalText, language)
          : selection.option.legalText;

        // Interpolate deal parameters into clause legalText
        legalText = interpolateParameters(
          legalText, dealParams, parameterSchema,
          clause.clauseTemplate.clauseId, language
        );

        // Optional clauses whose agreed option carries no legal text (e.g. a
        // "None — not applicable" choice) are omitted from the document entirely.
        if (legalText && legalText.trim()) {
          pushClause({
            title: clauseTitle,
            category: clauseCategory,
            agreedOption: selLocalized?.label
              ? resolveLocalizedString(selLocalized.label, language)
              : selection.option.label,
            legalText,
          }, clause.clauseTemplate.clauseId);
        }
      }
      continue;
    }

    // Resolve localized option fields
    const optLocalized = agreedOption.localizedContent as Record<string, unknown> | null;

    let legalText = optLocalized?.legalText
      ? resolveLocalizedString(optLocalized.legalText, language)
      : agreedOption.legalText;

    // Interpolate deal parameters into clause legalText
    legalText = interpolateParameters(
      legalText, dealParams, parameterSchema,
      clause.clauseTemplate.clauseId, language
    );

    // Optional clauses whose agreed option carries no legal text (e.g. a
    // "None — not applicable" choice) are omitted from the document entirely.
    if (legalText && legalText.trim()) {
      pushClause({
        title: clauseTitle,
        category: clauseCategory,
        agreedOption: optLocalized?.label
          ? resolveLocalizedString(optLocalized.label, language)
          : agreedOption.label,
        legalText,
      }, clause.clauseTemplate.clauseId);
    }
  }

  // Format date for boilerplate
  const effectiveDate = deal.createdAt.toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Extract signing details
  const sdA = initiator.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;
  const sdB = respondent?.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;

  // Build party names with signing details → company → name fallback
  const partyAName = sdA?.legalName || initiator.company || initiator.name || initiator.email;
  const partyBName = respondent
    ? (sdB?.legalName || respondent.company || respondent.name || respondent.email)
    : "[_________________]";

  const partyAAddress = sdA?.address || "[Address]";
  const partyBAddress = respondent ? (sdB?.address || "[Address]") : "[_________________]";
  const partyASignatoryName = sdA?.signatoryName || initiator.name || "[Name]";
  const partyBSignatoryName = respondent ? (sdB?.signatoryName || respondent.name || "[Name]") : "[_________________]";
  const partyASignatoryTitle = sdA?.signatoryTitle || "[Title]";
  const partyBSignatoryTitle = respondent ? (sdB?.signatoryTitle || "[Title]") : "[_________________]";

  // Variables for boilerplate interpolation
  const variables: Record<string, string> = {
    effectiveDate,
    governingLaw:
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[language] ||
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
      deal.governingLaw,
    partyAName,
    partyBName,
    partyAAddress,
    partyBAddress,
    partyAId: sdA?.taxId || "",
    partyBId: sdB?.taxId || "",
    partyAShortName: "Party A",
    partyBShortName: "Party B",
    partyASignatureBlock: `For and on behalf of ${partyAName}:\n\nSignature: _______________________________\n\nName: ${partyASignatoryName}\n\nTitle: ${partyASignatoryTitle}\n\nDate: ___________________________________`,
    partyBSignatureBlock: `For and on behalf of ${partyBName}:\n\nSignature: _______________________________\n\nName: ${partyBSignatoryName}\n\nTitle: ${partyBSignatoryTitle}\n\nDate: ___________________________________`,
  };

  // Merge deal parameter boilerplate variables into the variables dict
  const paramBoilerplateVars = buildBoilerplateVariables(dealParams, parameterSchema);
  Object.assign(variables, paramBoilerplateVars);

  // DPA Annex I data categories: turn the selected canonical keys into a
  // localized, lettered list, appending any free-text "other" entries. This
  // overrides the raw comma value that buildBoilerplateVariables produced for
  // {dataCategoriesList}.
  const dcParam = parameterSchema?.parameters?.find((p) => p.id === "data-categories");
  if (dcParam) {
    const keys = (dealParams["data-categories"] || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const labels = keys.map((k) =>
      dcParam.optionLabels?.[k]
        ? resolveLocalizedString(dcParam.optionLabels[k], language)
        : k
    );
    const other = (dealParams["data-categories-other"] || "").trim();
    if (other) {
      labels.push(...other.split(";").map((s) => s.trim()).filter(Boolean));
    }
    const letters = "abcdefghijklmnopqrstuvwxyz";
    variables.dataCategoriesList = labels.length
      ? labels.map((l, i) => `(${letters[i] || i + 1}) ${l};`).join("\n")
      : (language === "es"
          ? "(según se describa con más detalle en el contrato principal)"
          : "(as further described in the principal agreement)");
  }

  // Asymmetric-role contract (e.g. DPA: Controller vs Processor): Party A is the
  // Controller slot by convention. When the initiator / filling party chose the
  // Processor role instead, swap the A/B boilerplate variables so the preamble,
  // signature blocks and cover all place them under Processor and the
  // counterparty under Controller. The variable swap is identical for solo and
  // two-party; the party-object swap below differs (solo blanks the absent role,
  // two-party exchanges the two real parties).
  // Default (CONTROLLER / undefined) keeps the historical behaviour, so non-DPA
  // deals are untouched. Source of truth is the deal's soloFillRole column (set
  // at creation, editable at signing); fall back to the legacy per-party
  // signingDetails.fillRole for deals created before the column existed.
  const fillRole =
    deal.soloFillRole ?? (sdA as { fillRole?: string } | null)?.fillRole;
  const swapRoles = fillRole === "PROCESSOR";
  if (swapRoles) {
    for (const [a, b] of [
      ["partyAName", "partyBName"],
      ["partyAAddress", "partyBAddress"],
      ["partyAId", "partyBId"],
      ["partyASignatureBlock", "partyBSignatureBlock"],
    ]) {
      const tmp = variables[a];
      variables[a] = variables[b];
      variables[b] = tmp;
    }
  }

  // Cover-page party names follow the same A/B slots as the boilerplate text,
  // including the solo Processor swap above — so a processor's details show
  // under "Processor", not "Controller", on the cover.
  const coverPartyAName = variables.partyAName;
  const coverPartyBName = variables.partyBName;

  // Check for multi-jurisdiction parameters (e.g., Privacy Notice)
  const multiJurisdictionKeys = dealParams.jurisdictions
    ? dealParams.jurisdictions.split(",").map((j: string) => j.trim()).filter(Boolean)
    : undefined;

  // Process boilerplate with variable interpolation and i18n
  const boilerplate = processBoilerplate(
    deal.contractTemplate.boilerplate as Record<string, unknown> | null,
    deal.governingLaw,
    variables,
    language,
    multiJurisdictionKeys
  );

  // Check for agent deal attestation
  const agentDeal = await prisma.agentDealRoom.findFirst({
    where: { dealRoomId },
  });

  let agentAttestation: ContractData["agentAttestation"];
  if (agentDeal) {
    const uetaPreamble = `This agreement was formed by the interaction of electronic agents of the parties pursuant to the Uniform Electronic Transactions Act § 14 and the Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.). Each party authorized its electronic agent to negotiate and accept the terms herein.`;

    if (agentDeal.attestingBarNumber && agentDeal.attestingAttorneyName) {
      agentAttestation = {
        attorneyName: agentDeal.attestingAttorneyName,
        barNumber: agentDeal.attestingBarNumber,
        uetaPreamble,
        attestationFooter: `The legal provisions in this contract have been reviewed and attested by ${agentDeal.attestingAttorneyName} (Bar No. ${agentDeal.attestingBarNumber}) pursuant to UETA § 14 and the federal E-SIGN Act.`,
      };
    } else {
      // Still include UETA preamble for agent deals even without attorney attestation
      agentAttestation = {
        attorneyName: "",
        barNumber: "",
        uetaPreamble,
        attestationFooter: "",
      };
    }
  }

  // Build the party objects, then apply the Processor-role swap to the objects
  // themselves (not just the boilerplate variables) so EVERY renderer — cover,
  // parties section, and signature blocks in PDF/DOCX/TXT — shows each party
  // under the role they chose.
  let outPartyA: PartyData = {
    name: initiator.name || initiator.email,
    email: initiator.email,
    company: initiator.company || undefined,
    legalName: sdA?.legalName,
    address: sdA?.address,
    taxId: sdA?.taxId,
    signatoryName: sdA?.signatoryName,
    signatoryTitle: sdA?.signatoryTitle,
    signature: deal.signingRequest?.initiatorSignature || undefined,
    signedAt: deal.signingRequest?.initiatorSignedAt || undefined,
  };
  let outPartyB: PartyData | null = respondent
    ? {
        name: respondent.name || respondent.email,
        email: respondent.email,
        company: respondent.company || undefined,
        legalName: sdB?.legalName,
        address: sdB?.address,
        taxId: sdB?.taxId,
        signatoryName: sdB?.signatoryName,
        signatoryTitle: sdB?.signatoryTitle,
        signature: deal.signingRequest?.respondentSignature || undefined,
        signedAt: deal.signingRequest?.respondentSignedAt || undefined,
      }
    : null;

  if (swapRoles) {
    if (isSolo || !outPartyB) {
      outPartyB = outPartyA; // filling party → Processor (slot B)
      outPartyA = { name: "[_________________]", email: "" }; // Controller (slot A) left blank
    } else {
      // Two-party: a true swap so the initiator lands in the Processor slot and
      // the respondent in the Controller slot — each keeps their own signature.
      const tmp = outPartyA;
      outPartyA = outPartyB;
      outPartyB = tmp;
    }
  }

  return {
    dealName: deal.name,
    contractType: deal.contractTemplate.displayName,
    governingLaw:
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[language] ||
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
      deal.governingLaw,
    governingLawKey: deal.governingLaw,
    createdAt: deal.createdAt,
    partyA: outPartyA,
    partyB: outPartyB,
    clauses,
    governingLawArticle,
    coverPartyAName,
    coverPartyBName,
    boilerplate,
    language,
    agentAttestation,
  };
}

/**
 * Validates that a user is a party to the deal
 */
export async function validateDealAccess(
  dealRoomId: string,
  userId: string
): Promise<boolean> {
  const party = await prisma.dealRoomParty.findFirst({
    where: {
      dealRoomId,
      userId,
    },
  });

  return party !== null;
}

/**
 * Checks if the deal is in a signable state
 */
export async function isDealSignable(dealRoomId: string): Promise<boolean> {
  const deal = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    select: { status: true },
  });

  if (!deal) {
    return false;
  }

  return ["AGREED", "SIGNING", "COMPLETED"].includes(deal.status);
}

/**
 * Enrich ContractData with certification data from the signing request.
 * If no certification exists, returns data unchanged.
 */
export async function enrichWithCertification(
  dealRoomId: string,
  data: ContractData
): Promise<ContractData> {
  try {
    const signingRequest = await prisma.signingRequest.findFirst({
      where: { dealRoomId },
      orderBy: { createdAt: "desc" },
    });

    if (!signingRequest?.ceremonyId) {
      return data;
    }

    const certData = await certificationService.buildCertificationData(
      signingRequest.ceremonyId
    );

    if (!certData.certified) {
      return data;
    }

    return { ...data, certification: certData };
  } catch (error) {
    logger.error("Failed to enrich with certification", { err: String(error) });
    return data;
  }
}

/**
 * Human-readable filename for a generated contract document.
 * Format: Dealroom-{ContractType}-{DealName}-{YYYY-MM-DD}.{ext}
 * Preserves readable case, collapses spaces + unsafe chars to single hyphens.
 */
export function buildContractFilename(data: ContractData, ext: "pdf" | "docx" | "txt"): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[\/\\?%*:|"<>]/g, "")
      .replace(/[^\p{L}\p{N}\-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

  const date = new Date().toISOString().slice(0, 10);
  const parts = ["Dealroom", slug(data.contractType), slug(data.dealName), date].filter(Boolean);
  return `${parts.join("-")}.${ext}`;
}
