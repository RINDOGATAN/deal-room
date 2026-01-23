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

export interface ContractData {
  dealName: string;
  contractType: string;
  governingLaw: string;
  createdAt: Date;
  partyA: PartyData;
  partyB: PartyData;
  clauses: ClauseData[];
}

const GOVERNING_LAW_DISPLAY: Record<string, string> = {
  CALIFORNIA: "State of California, United States of America",
  ENGLAND_WALES: "England and Wales, United Kingdom",
  SPAIN: "Kingdom of Spain",
};

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

  return {
    dealName: deal.name,
    contractType: deal.contractTemplate.displayName,
    governingLaw:
      GOVERNING_LAW_DISPLAY[deal.governingLaw] || deal.governingLaw,
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
