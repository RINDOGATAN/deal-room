/**
 * Contract Document Generator Service
 *
 * Compiles deal room data into structured contract data for PDF generation.
 */

import prisma from "@/lib/prisma";

export interface PartyData {
  name: string;
  email: string;
  company?: string;
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
}

const GOVERNING_LAW_DISPLAY: Record<string, string> = {
  CALIFORNIA: "State of California, United States of America",
  ENGLAND_WALES: "England and Wales, United Kingdom",
  SPAIN: "Kingdom of Spain",
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
  variables: Record<string, string>
): BoilerplateData | null {
  if (!rawBoilerplate) {
    return null;
  }

  const bp = rawBoilerplate as {
    contractTitle?: string;
    preamble?: string;
    background?: string;
    definitions?: Array<{ term: string; definition: string }>;
    standardClauses?: Array<{ title: string; text: string }>;
    generalProvisions?: Array<{ title: string; text: string }>;
    jurisdictionProvisions?: Record<string, { title: string; text: string }>;
    signatureBlock?: string;
  };

  // Get jurisdiction-specific provision
  const jurisdictionProvision = bp.jurisdictionProvisions?.[governingLawKey]
    ? {
        title: bp.jurisdictionProvisions[governingLawKey].title,
        text: interpolateText(
          bp.jurisdictionProvisions[governingLawKey].text,
          variables
        ),
      }
    : null;

  return {
    contractTitle: bp.contractTitle || "",
    preamble: interpolateText(bp.preamble || "", variables),
    background: bp.background
      ? interpolateText(bp.background, variables)
      : undefined,
    definitions: (bp.definitions || []).map((d) => ({
      term: d.term,
      definition: interpolateText(d.definition, variables),
    })),
    standardClauses: (bp.standardClauses || []).map((c) => ({
      title: c.title,
      text: interpolateText(c.text, variables),
    })),
    generalProvisions: (bp.generalProvisions || []).map((p) => ({
      title: p.title,
      text: interpolateText(p.text, variables),
    })),
    jurisdictionProvision,
    signatureBlock: interpolateText(bp.signatureBlock || "", variables),
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

  // Compile clauses with agreed options
  const clauses: ClauseData[] = [];

  for (const clause of deal.clauses) {
    if (clause.status !== "AGREED" || !clause.agreedOptionId) {
      continue;
    }

    // Find the agreed option from the clause template options
    const agreedOption = clause.clauseTemplate.options.find(
      (opt) => opt.id === clause.agreedOptionId
    );

    if (!agreedOption) {
      // Fallback: try to find from selection if agreedOptionId doesn't match
      const selection = clause.selections[0];
      if (selection?.option) {
        clauses.push({
          title: clause.clauseTemplate.title,
          category: clause.clauseTemplate.category,
          agreedOption: selection.option.label,
          legalText: selection.option.legalText,
        });
      }
      continue;
    }

    clauses.push({
      title: clause.clauseTemplate.title,
      category: clause.clauseTemplate.category,
      agreedOption: agreedOption.label,
      legalText: agreedOption.legalText,
    });
  }

  // Format date for boilerplate
  const effectiveDate = deal.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build party names with company fallback
  const partyAName = initiator.company || initiator.name || initiator.email;
  const partyBName = respondent.company || respondent.name || respondent.email;

  // Variables for boilerplate interpolation
  const variables: Record<string, string> = {
    effectiveDate,
    partyAName,
    partyBName,
    partyAAddress: "[Address]",
    partyBAddress: "[Address]",
    partyAShortName: "Party A",
    partyBShortName: "Party B",
    partyASignatureBlock: `For and on behalf of ${partyAName}:\n\nSignature: _______________________________\n\nName: ${initiator.name || "[Name]"}\n\nTitle: [Title]\n\nDate: ___________________________________`,
    partyBSignatureBlock: `For and on behalf of ${partyBName}:\n\nSignature: _______________________________\n\nName: ${respondent.name || "[Name]"}\n\nTitle: [Title]\n\nDate: ___________________________________`,
  };

  // Process boilerplate with variable interpolation
  const boilerplate = processBoilerplate(
    deal.contractTemplate.boilerplate as Record<string, unknown> | null,
    deal.governingLaw,
    variables
  );

  return {
    dealName: deal.name,
    contractType: deal.contractTemplate.displayName,
    governingLaw:
      GOVERNING_LAW_DISPLAY[deal.governingLaw] || deal.governingLaw,
    governingLawKey: deal.governingLaw,
    createdAt: deal.createdAt,
    partyA: {
      name: initiator.name || initiator.email,
      email: initiator.email,
      company: initiator.company || undefined,
    },
    partyB: {
      name: respondent.name || respondent.email,
      email: respondent.email,
      company: respondent.company || undefined,
    },
    clauses,
    boilerplate,
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
