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

/**
 * Step statuses stored in StartupJourney.stepStatuses JSON blob.
 * Keep this in sync with the UI render in /launch/[id]/page.tsx.
 */
export type StepStatus =
  | "NOT_STARTED"
  | "READY_FOR_REVIEW"
  | "AWAITING_REVIEW"
  | "REVIEWED"
  | "FILED"
  | "DONE_ELSEWHERE";

/** Statuses that count a step as "advanced enough" to unlock its dependents. */
export const UNLOCKING_STATUSES = new Set<StepStatus>([
  "READY_FOR_REVIEW",
  "AWAITING_REVIEW",
  "REVIEWED",
  "FILED",
  "DONE_ELSEWHERE",
]);

export interface StepStatusEntry {
  status?: StepStatus;
  completedAt?: string;
  filedAt?: string;
  markedDoneAt?: string;
  note?: string;
  supervisorId?: string;
  dealIds?: string[];
  answers?: Record<string, string>;
}

/** Is a step unlocked? Either it has no dependency or its dependency is at an unlocking status. */
export function isStepUnlocked(
  key: StepKey,
  statuses: Record<string, StepStatusEntry>,
): boolean {
  const dep = STEP_META[key].unlockedBy;
  if (dep == null) return true;
  const depStatus = (statuses[dep]?.status ?? "NOT_STARTED") as StepStatus;
  return UNLOCKING_STATUSES.has(depStatus);
}

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

  // 1. Certificate of Incorporation (one per journey).
  // Authorized share count is now a clause choice (5M / 10M / 20M), not a
  // parameter — the founder picks it at negotiate-time so they see the tradeoff.
  deals.push({
    contractType: "DELAWARE_CERT_OF_INCORPORATION",
    name: `${companyName} — Certificate of Incorporation`,
    parameters: {
      "company-name": companyName,
      "registered-agent": registeredAgent,
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
      contractType: "FOUNDERS",
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
  {
    title: string;
    description: string;
    estimatedMinutes: number;
    unlockedBy: StepKey | null;
    /**
     * Until a step's guided flow is built, its hub card offers a fallback:
     * "Create individually" linking to /deals/new with this search query
     * pre-filled. Keeps founders unblocked.
     */
    fallbackSearch?: string;
    /** Short list of skill names shown next to the fallback link so the founder knows what's available. */
    fallbackSkills?: string[];
  }
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
    fallbackSearch: "Equity Incentive",
    fallbackSkills: ["Equity Incentive Plan"],
  },
  hiring: {
    title: "Hire your first people",
    description: "Offer letters, employment agreements, and option grants for your first hires.",
    estimatedMinutes: 6,
    unlockedBy: "equity-pool",
    fallbackSearch: "employment",
    fallbackSkills: ["Employment Agreement", "Advisory Agreement", "Consulting Agreement"],
  },
  raise: {
    title: "Raise your first round",
    description:
      "Generate a SAFE, convertible note, or term sheet — whichever fits the conversation.",
    estimatedMinutes: 6,
    unlockedBy: "foundation",
    fallbackSearch: "SAFE",
    fallbackSkills: ["SAFE", "Convertible Note", "Term Sheet", "Shareholders Agreement"],
  },
};

/**
 * Plain-language copy for the "I have this already" dialog. Each step speaks
 * in its own terms so founders see exactly which docs we're taking on faith.
 */
export const STEP_DONE_COPY: Record<
  StepKey,
  {
    title: string;
    explainer: string;
    docsYouShouldHave: string[];
    confirmCta: string;
  }
> = {
  foundation: {
    title: "You've already formed your company",
    explainer:
      "We won't generate anything for this step — marking it as done just unlocks the later steps so you can keep moving.",
    docsYouShouldHave: [
      "Certificate of Incorporation filed with Delaware",
      "A Founders' Agreement (or equivalent stock-purchase agreement) for each founder",
      "An IP Assignment signed by each founder",
    ],
    confirmCta: "I have everything — mark as done",
  },
  "equity-pool": {
    title: "You've already set up your option pool",
    explainer:
      "We'll skip generating the Equity Incentive Plan. You can still use the Hiring step to produce offer letters and individual option grants under your existing plan.",
    docsYouShouldHave: [
      "A board-adopted Equity Incentive Plan (or similar option-pool document)",
      "Reserved shares set aside in your cap table for option grants",
    ],
    confirmCta: "I have a plan in place — mark as done",
  },
  hiring: {
    title: "You've already hired your team",
    explainer:
      "We'll skip the Hiring step. If you add more hires later, you can always come back and generate fresh offer letters or option grants.",
    docsYouShouldHave: [
      "Signed offer letters or employment agreements for every hire",
      "Signed IP assignment or PIIA from each employee",
      "Option grant agreements for anyone with equity, referencing your plan",
    ],
    confirmCta: "My team's in place — mark as done",
  },
  raise: {
    title: "You've already closed your first round",
    explainer:
      "We'll skip the Raise step. Coming back to raise again? Start a fresh journey or re-open this step to generate new SAFEs, notes, or a term sheet.",
    docsYouShouldHave: [
      "Signed SAFE, convertible note, or priced-round stock-purchase agreement with each investor",
      "Updated cap table reflecting the round",
      "Board / shareholder consents authorizing the issuance",
    ],
    confirmCta: "My round is closed — mark as done",
  },
};
