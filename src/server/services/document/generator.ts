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

export interface PartyData {
  name: string;
  email: string;
  company?: string;
  legalName?: string;
  address?: string;
  taxId?: string;
  signatoryName?: string;
  signatoryTitle?: string;
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
  signatureBlock: string;
  partyLabels?: { partyA: string; partyB: string };
}

export interface ContractData {
  dealName: string;
  contractType: string;
  governingLaw: string;
  governingLawKey: string;
  createdAt: Date;
  partyA: PartyData;
  partyB: PartyData;
  clauses: ClauseData[];
  boilerplate: BoilerplateData | null;
  language: string;
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
  language: string = "en"
): BoilerplateData | null {
  if (!rawBoilerplate) {
    return null;
  }

  const bp = rawBoilerplate as Record<string, unknown>;

  // Helper: resolve i18n then interpolate variables
  const resolve = (val: unknown): string =>
    interpolateText(resolveLocalizedString(val, language), variables);

  // Get jurisdiction-specific provision
  const jpMap = bp.jurisdictionProvisions as Record<string, Record<string, unknown>> | undefined;
  const jp = jpMap?.[governingLawKey];
  const jurisdictionProvision = jp
    ? { title: resolve(jp.title), text: resolve(jp.text) }
    : null;

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

  const partyLabels = bp.partyLabels as Record<string, unknown> | undefined;

  return {
    contractTitle: resolveLocalizedString(bp.contractTitle, language) || "",
    preamble: resolve(bp.preamble),
    background: bp.background ? resolve(bp.background) : undefined,
    definitions,
    standardClauses,
    generalProvisions,
    jurisdictionProvision,
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

  if (!initiator || !respondent) {
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

        clauses.push({
          title: clauseTitle,
          category: clauseCategory,
          agreedOption: selLocalized?.label
            ? resolveLocalizedString(selLocalized.label, language)
            : selection.option.label,
          legalText,
        });
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

    clauses.push({
      title: clauseTitle,
      category: clauseCategory,
      agreedOption: optLocalized?.label
        ? resolveLocalizedString(optLocalized.label, language)
        : agreedOption.label,
      legalText,
    });
  }

  // Format date for boilerplate
  const effectiveDate = deal.createdAt.toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Extract signing details
  const sdA = initiator.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;
  const sdB = respondent.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;

  // Build party names with signing details → company → name fallback
  const partyAName = sdA?.legalName || initiator.company || initiator.name || initiator.email;
  const partyBName = sdB?.legalName || respondent.company || respondent.name || respondent.email;

  const partyAAddress = sdA?.address || "[Address]";
  const partyBAddress = sdB?.address || "[Address]";
  const partyASignatoryName = sdA?.signatoryName || initiator.name || "[Name]";
  const partyBSignatoryName = sdB?.signatoryName || respondent.name || "[Name]";
  const partyASignatoryTitle = sdA?.signatoryTitle || "[Title]";
  const partyBSignatoryTitle = sdB?.signatoryTitle || "[Title]";

  // Variables for boilerplate interpolation
  const variables: Record<string, string> = {
    effectiveDate,
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

  // Process boilerplate with variable interpolation and i18n
  const boilerplate = processBoilerplate(
    deal.contractTemplate.boilerplate as Record<string, unknown> | null,
    deal.governingLaw,
    variables,
    language
  );

  return {
    dealName: deal.name,
    contractType: deal.contractTemplate.displayName,
    governingLaw:
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[language] ||
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
      deal.governingLaw,
    governingLawKey: deal.governingLaw,
    createdAt: deal.createdAt,
    partyA: {
      name: initiator.name || initiator.email,
      email: initiator.email,
      company: initiator.company || undefined,
      legalName: sdA?.legalName,
      address: sdA?.address,
      taxId: sdA?.taxId,
      signatoryName: sdA?.signatoryName,
      signatoryTitle: sdA?.signatoryTitle,
    },
    partyB: {
      name: respondent.name || respondent.email,
      email: respondent.email,
      company: respondent.company || undefined,
      legalName: sdB?.legalName,
      address: sdB?.address,
      taxId: sdB?.taxId,
      signatoryName: sdB?.signatoryName,
      signatoryTitle: sdB?.signatoryTitle,
    },
    clauses,
    boilerplate,
    language,
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
