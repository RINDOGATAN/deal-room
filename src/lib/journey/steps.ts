/**
 * Step registry for the Startup Quick Start journey.
 *
 * Each step maps plain-language founder answers to the deals that should be
 * generated: contract type, name, and pre-filled parameters. The journey
 * router iterates the returned deals and creates one DealRoom per entry.
 *
 * MVP scope: Foundation step only. Equity pool, Hiring, Raise stubs are here
 * for scaffolding and will be filled in later increments.
 */

import type { StartupJourney, JourneyFounder } from "@prisma/client";

export type StepKey = "foundation" | "equity-pool" | "hiring" | "raise";

export const STEP_ORDER: StepKey[] = ["foundation", "equity-pool", "hiring", "raise"];

export interface StepPlan {
  stepKey: StepKey;
  deals: Array<{
    contractType: string;
    name: string;
    parameters: Record<string, string>;
  }>;
}

type JourneyWithFounders = StartupJourney & { founders: JourneyFounder[] };

/**
 * Business question registry. `copy.ts` renders these; `getStepPlan` consumes
 * the answers when generating deals. Keep these in sync with the parameters
 * each skill expects.
 */
export const FOUNDATION_QUESTIONS = [
  {
    key: "vesting",
    recommended: "standard",
    options: ["standard", "founder-friendly", "aggressive"] as const,
  },
  {
    key: "ip-scope",
    recommended: "broad",
    options: ["broad", "narrow"] as const,
  },
] as const;

export function getStepPlan(
  stepKey: StepKey,
  journey: JourneyWithFounders,
  answers: Record<string, string>,
): StepPlan {
  switch (stepKey) {
    case "foundation":
      return buildFoundationPlan(journey, answers);
    default:
      return { stepKey, deals: [] };
  }
}

function buildFoundationPlan(
  journey: JourneyWithFounders,
  _answers: Record<string, string>,
): StepPlan {
  const deals: StepPlan["deals"] = [];
  const companyName = journey.companyName;
  const registeredAgent = journey.companyAddress ?? "[Registered agent TBD]";

  // 1. Certificate of Incorporation (one per journey)
  deals.push({
    contractType: "DELAWARE_CERT_OF_INCORPORATION",
    name: `${companyName} — Certificate of Incorporation`,
    parameters: {
      "company-name": companyName,
      "registered-agent": registeredAgent,
      "authorized-shares": String(journey.authorizedShares),
      "par-value": journey.parValue.toString(),
      incorporator: journey.founders.find((f) => f.isIncorporator)?.name
        ?? journey.founders.find((f) => f.isPrimary)?.name
        ?? journey.founders[0]?.name
        ?? "",
    },
  });

  // 2. Founders' Agreement + IP Assignment per founder
  for (const founder of journey.founders) {
    const founderLabel = founder.name;
    const equity = founder.equityPercent?.toString() ?? "";

    deals.push({
      contractType: "FOUNDERS_AGREEMENT",
      name: `${companyName} — Founders' Agreement — ${founderLabel}`,
      parameters: {
        "company-name": companyName,
        "founder-name": founder.name,
        "founder-email": founder.email,
        ...(equity ? { "equity-percent": equity } : {}),
        "vesting-years": String(founder.vestingYears ?? 4),
        "cliff-months": String(founder.cliffMonths ?? 12),
      },
    });

    deals.push({
      contractType: "IP_ASSIGNMENT",
      name: `${companyName} — IP Assignment — ${founderLabel}`,
      parameters: {
        "company-name": companyName,
        "assignor-name": founder.name,
        "assignor-email": founder.email,
      },
    });
  }

  return { stepKey: "foundation", deals };
}

/** Metadata for the journey hub — labels, estimated time, dependencies. */
export const STEP_META: Record<
  StepKey,
  { title: string; description: string; estimatedMinutes: number; unlockedBy: StepKey | null }
> = {
  foundation: {
    title: "Form your company",
    description:
      "Generate your Certificate of Incorporation, Founders' Agreements, and IP Assignments.",
    estimatedMinutes: 8,
    unlockedBy: null,
  },
  "equity-pool": {
    title: "Set up your option pool",
    description: "Create the Equity Incentive Plan that governs all future option grants.",
    estimatedMinutes: 5,
    unlockedBy: "foundation",
  },
  hiring: {
    title: "Hire your first people",
    description: "Offer letters, employment agreements, and option grants for your first hires.",
    estimatedMinutes: 6,
    unlockedBy: "equity-pool",
  },
  raise: {
    title: "Raise your first round",
    description:
      "Generate a SAFE, convertible note, or term sheet — whichever fits the conversation.",
    estimatedMinutes: 6,
    unlockedBy: "foundation",
  },
};
