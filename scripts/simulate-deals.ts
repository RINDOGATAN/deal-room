/**
 * Deal Simulator Script
 *
 * Smoke-tests the entire deal lifecycle for every available contract skill
 * by simulating both parties, then validates the generated contract output.
 * Completed deals double as demo content visible in a demo account.
 *
 * Usage:
 *   npm run deal:simulate            # create demo deals (idempotent)
 *   npm run deal:simulate -- --clean # recreate from scratch
 */

import {
  PrismaClient,
  DealRoomStatus,
  DealMode,
  PartyRole,
  PartyStatus,
  ClauseStatus,
  GoverningLaw,
} from "@prisma/client";
import {
  calculateCompromise,
  globalFairnessPass,
  type OptionInput,
} from "../src/server/services/compromise/engine";
import { resolveLocalizedString } from "../src/server/services/skills/i18n";
import type { ParameterSchema } from "../src/lib/parameters";
import { buildBoilerplateVariables } from "../src/lib/parameters";

const prisma = new PrismaClient();

// ── Constants ─────────────────────────────────────────────────

const DEMO_DEAL_PREFIX = "Demo:";

const DEMO_USERS = {
  alice: {
    email: "alice@demo.todo.law",
    name: "Alice Johnson",
    company: "Acme Corp",
  },
  bob: {
    email: "bob@demo.todo.law",
    name: "Bob Smith",
    company: "Widget Inc",
  },
};

// Demo parameter values for parameterized templates
const DEMO_PARAMETERS: Record<string, Record<string, string>> = {
  SEED_INVESTMENT: {
    "pre-money-valuation": "$2,000,000",
    "investment-amount": "$500,000",
    "share-count": "500,000",
    "share-price": "$1.00",
    "board-size": "3",
    "dividend-rate": "8",
    "qualified-financing-threshold": "$1,000,000",
    "lock-up-months": "12",
    "legal-fee-cap": "$25,000",
    "business-description": "developing AI-powered legal technology solutions",
    "court-county": "San Francisco",
    "court-city": "Madrid",
    "arbitration-institution": "ICC (International Chamber of Commerce)",
    "arbitration-language": "English",
  },
  CONVERTIBLE_NOTE: {
    "principal-amount": "500,000",
    "valuation-cap-amount": "5,000,000",
    "prepayment-premium": "5",
  },
  SAFE: {
    "valuation-cap-amount": "5,000,000",
    "pro-rata-threshold": "1,000,000",
  },
  TERM_SHEET: {
    "round-amount": "3,000,000",
    "closing-date": "December 31, 2026",
    "series-designation": "A",
    "round-minimum": "1,000,000",
    "round-maximum": "5,000,000",
    "milestone-1": "Product launch",
    "milestone-2": "1,000 active users",
    "round-tranche-count": "2",
    "pre-money-valuation": "10,000,000",
    "original-issue-price": "1.00",
    "option-pool-pct": "10",
    "liquidation-multiple": "1",
    "debt-threshold": "100,000",
    "dividend-rate": "8",
    "legal-fee-cap": "25,000",
  },
  CONSULTING: {
    "service-description": "software development and technical advisory services",
    "monthly-hours": "40",
    "deposit-pct": "25",
    "hourly-rate": "250",
    "max-hours": "160",
    "term-months": "12",
    "start-date": "January 1, 2026",
    "geographic-area": "State of California",
    "kill-fee-pct": "25",
    "liability-multiple": "2",
  },
  SHAREHOLDERS: {
    "board-size": "5",
    "board-appoint-pct": "20",
    "appointing-body": "Nominating Committee",
    "transaction-threshold": "50,000",
    "lockup-months": "24",
    "min-distribution-pct": "30",
    "mediation-body": "CEDR",
    "exit-years": "5",
    "non-compete-area": "United States",
    "court-city": "London",
    "court-county": "San Francisco",
    "arbitration-body": "ICC",
    "company-name": "Acme Technologies Ltd.",
    "company-jurisdiction": "England and Wales",
    "company-number": "12345678",
    "company-address": "200 High Holborn, London WC1V 7EX",
  },
  EMPLOYMENT: {
    "start-date": "March 1, 2026",
    "end-date": "February 28, 2027",
    "base-salary": "120,000",
    "base-amount": "120,000",
    "bonus-pct": "20",
    "equity-shares": "10,000",
    "office-days": "3",
    "office-address": "100 Market St, San Francisco, CA 94105",
    "time-zone": "Pacific Time (PT)",
    "non-compete-area": "State of California",
    "dispute-city": "San Francisco",
    "arbitration-body": "JAMS",
  },
  IP_ASSIGNMENT: {
    "ip-start-date": "January 1, 2024",
    "ip-end-date": "December 31, 2025",
    "subject-matter": "mobile application for fleet management",
    "assignment-fee": "50,000",
    "royalty-years": "5",
    "royalty-pct": "5",
  },
  ADVERTISING_IO: {
    "campaign-name": "Q2 Brand Awareness Campaign",
    "total-budget": "$100,000",
    "start-date": "April 1, 2026",
    "end-date": "June 30, 2026",
    "impressions-target": "5,000,000",
    "base-cpm": "$12.50",
  },
  AFFILIATE_PROGRAM: {
    "program-name": "Partner Referral Program",
    "base-commission": "20",
    "cookie-window": "30",
    "disclosure-text": "This content contains affiliate links. The author may earn a commission on qualifying purchases.",
    "product-category": "legal technology software",
  },
  ACTA_JUNTA_GENERAL: {
    "company-name": "Acme Technologies, S.L.",
    "cif": "B12345678",
    "registered-address": "Calle Gran Vía 1, 28013 Madrid",
    "meeting-date": "15 de marzo de 2026",
    "meeting-type": "Ordinaria",
    "quorum-percentage": "75%",
    "secretary-name": "María García López",
    "president-name": "Juan Martínez Ruiz",
  },
  ACTA_CONSEJO_ADMINISTRACION: {
    "company-name": "Acme Technologies, S.L.",
    "cif": "B12345678",
    "registered-address": "Calle Gran Vía 1, 28013 Madrid",
    "meeting-date": "15 de marzo de 2026",
    "president-name": "Juan Martínez Ruiz",
    "secretary-name": "María García López",
  },
  PHANTOM_SHARES_PLAN: {
    "company-name": "Acme Technologies, S.L.",
    "cif": "B12345678",
    "total-pool-percentage": "10%",
    "cliff-months": "12",
    "vesting-months": "48",
    "plan-effective-date": "1 de enero de 2026",
    "city": "Madrid",
  },
  PHANTOM_SHARES_GRANT: {
    "employee-name": "Ana López García",
    "phantom-count": "1.000",
    "grant-date": "15 de marzo de 2026",
    "plan-date": "1 de enero de 2026",
    "individual-vesting-months": "48",
    "city": "Madrid",
  },
  PRIVACY_NOTICE: {
    "jurisdictions": "CALIFORNIA,ENGLAND_WALES,SPAIN",
    "company-name": "Acme Technologies Inc.",
    "company-website": "https://acme.example.com",
    "dpo-email": "privacy@acme.example.com",
    "effective-date": "March 1, 2026",
  },
  PRIVACY_NOTICE_ES: {
    "jurisdictions": "SPAIN,ENGLAND_WALES",
    "company-name": "Acme Tecnologías, S.L.",
    "company-website": "https://acme.ejemplo.es",
    "dpo-email": "privacidad@acme.ejemplo.es",
    "effective-date": "1 de marzo de 2026",
  },
  DATA_LICENSING: {
    "data-categories": "anonymized user analytics and usage metrics",
    "license-fee": "$50,000",
    "license-term": "24 months",
  },
  INFLUENCER_MARKETING: {
    "campaign-name": "Summer Product Launch",
    "total-compensation": "$25,000",
    "num-deliverables": "10",
    "campaign-start": "June 1, 2026",
    "campaign-end": "August 31, 2026",
  },
  WHITE_LABEL_RESELLER: {
    "territory": "European Union",
    "minimum-commitment": "$100,000",
    "revenue-share-pct": "30",
    "support-sla-hours": "24",
  },
};

interface DealVariant {
  contractType: string;
  jurisdiction: GoverningLaw;
  language: string;
  hasBoilerplate: boolean;
  dealMode?: "SOLO" | "NEGOTIATION";
}

const DEAL_VARIANTS: DealVariant[] = [
  { contractType: "DPA", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "DPA", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "NDA", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "NDA", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "MSA", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "MSA", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "SAAS", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "SAAS", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "SEED_INVESTMENT", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "SEED_INVESTMENT", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "ADVERTISING_IO", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "ADVERTISING_IO", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "AFFILIATE_PROGRAM", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "AFFILIATE_PROGRAM", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "ACTA_JUNTA_GENERAL", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true, dealMode: "SOLO" },
  { contractType: "ACTA_CONSEJO_ADMINISTRACION", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true, dealMode: "SOLO" },
  { contractType: "PHANTOM_SHARES_PLAN", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true, dealMode: "SOLO" },
  { contractType: "PHANTOM_SHARES_GRANT", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true, dealMode: "SOLO" },
  { contractType: "PRIVACY_NOTICE", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true, dealMode: "SOLO" },
  { contractType: "PRIVACY_NOTICE", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true, dealMode: "SOLO" },
  // Premium bilingual skills
  { contractType: "CONSULTING", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "CONSULTING", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "CONVERTIBLE_NOTE", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "CONVERTIBLE_NOTE", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "DATA_LICENSING", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "DATA_LICENSING", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "EMPLOYMENT", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "EMPLOYMENT", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "FOUNDERS", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "FOUNDERS", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "INFLUENCER_MARKETING", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "INFLUENCER_MARKETING", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "IP_ASSIGNMENT", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "IP_ASSIGNMENT", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "SAFE", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "SAFE", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "SHAREHOLDERS", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "SHAREHOLDERS", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "TERM_SHEET", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "TERM_SHEET", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "WHITE_LABEL_RESELLER", jurisdiction: GoverningLaw.CALIFORNIA, language: "en", hasBoilerplate: true },
  { contractType: "WHITE_LABEL_RESELLER", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  // Spanish-native premium skills
  { contractType: "CESION_PI", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "CONTRATO_LABORAL", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "CONTRATO_SERVICIOS", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
  { contractType: "PACTO_SOCIOS", jurisdiction: GoverningLaw.SPAIN, language: "es", hasBoilerplate: true },
];

// ── Types ─────────────────────────────────────────────────────

interface SimulationResult {
  variant: DealVariant;
  dealRoomId: string;
  clauseCount: number;
  expectedClauseCount: number;
  satisfactionA: number;
  satisfactionB: number;
  status: string;
  skipped?: boolean;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

interface ValidationResult {
  variant: DealVariant;
  checks: ValidationCheck[];
  allPassed: boolean;
}

// ── Helpers ───────────────────────────────────────────────────

async function ensureDemoUsers() {
  const userA = await prisma.user.upsert({
    where: { email: DEMO_USERS.alice.email },
    create: {
      email: DEMO_USERS.alice.email,
      name: DEMO_USERS.alice.name,
      company: DEMO_USERS.alice.company,
    },
    update: {
      name: DEMO_USERS.alice.name,
      company: DEMO_USERS.alice.company,
    },
  });

  const userB = await prisma.user.upsert({
    where: { email: DEMO_USERS.bob.email },
    create: {
      email: DEMO_USERS.bob.email,
      name: DEMO_USERS.bob.name,
      company: DEMO_USERS.bob.company,
    },
    update: {
      name: DEMO_USERS.bob.name,
      company: DEMO_USERS.bob.company,
    },
  });

  return { userA, userB };
}

function selectOptionForParty(
  options: Array<{ id: string; order: number; biasPartyA: number; biasPartyB: number }>,
  party: "A" | "B",
  clauseOrder: number,
): { optionId: string; priority: number; flexibility: number } {
  const sorted = [...options].sort((a, b) => {
    const biasA = party === "A" ? a.biasPartyA : a.biasPartyB;
    const biasB = party === "A" ? b.biasPartyA : b.biasPartyB;
    return biasB - biasA;
  });

  // Even-ordered clauses: pick index 0 (most favorable)
  // Odd-ordered clauses: pick index 1 (2nd most favorable) — if available
  const pickIndex = clauseOrder % 2 === 0 ? 0 : Math.min(1, sorted.length - 1);
  const picked = sorted[pickIndex];

  const bias = Math.abs(party === "A" ? picked.biasPartyA : picked.biasPartyB);
  const priority = bias > 0.3 ? 5 : bias > 0.1 ? 4 : 3;
  const flexibility = bias > 0.3 ? 1 : bias > 0.1 ? 2 : 3;

  return { optionId: picked.id, priority, flexibility };
}

// ── Simulate Deal ─────────────────────────────────────────────

async function simulateDeal(
  variant: DealVariant,
  userA: { id: string; email: string; name: string | null; company: string | null },
  userB: { id: string; email: string; name: string | null; company: string | null },
): Promise<SimulationResult> {
  const dealName = `${DEMO_DEAL_PREFIX} ${variant.contractType} (${variant.jurisdiction}/${variant.language})`;

  // Idempotency: skip if deal already exists
  const existing = await prisma.dealRoom.findFirst({
    where: { name: dealName },
  });
  if (existing) {
    console.log(`  skip  "${dealName}" — already exists`);
    const clauseCount = await prisma.dealRoomClause.count({
      where: { dealRoomId: existing.id },
    });
    return {
      variant,
      dealRoomId: existing.id,
      clauseCount,
      expectedClauseCount: clauseCount,
      satisfactionA: 0,
      satisfactionB: 0,
      status: existing.status,
      skipped: true,
    };
  }

  // Find template with clauses + options
  const template = await prisma.contractTemplate.findUnique({
    where: { contractType: variant.contractType },
    include: {
      clauses: {
        include: { options: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!template) {
    throw new Error(`Template not found: ${variant.contractType}`);
  }

  console.log(`  create "${dealName}" (${template.clauses.length} clauses)...`);

  // ── Step 1: Create DealRoom (DRAFT) with initiator party + clauses ──

  // Provide demo parameter values if the template has a parameter schema
  const demoParams = DEMO_PARAMETERS[
    variant.language === "es" && DEMO_PARAMETERS[`${variant.contractType}_ES`]
      ? `${variant.contractType}_ES`
      : variant.contractType
  ] || null;

  const dealRoom = await prisma.dealRoom.create({
    data: {
      name: dealName,
      contractTemplateId: template.id,
      governingLaw: variant.jurisdiction,
      contractLanguage: variant.language,
      parameters: demoParams || undefined,
      status: DealRoomStatus.DRAFT,
      parties: {
        create: {
          role: PartyRole.INITIATOR,
          status: PartyStatus.PENDING,
          email: userA.email,
          name: userA.name,
          company: userA.company,
          userId: userA.id,
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
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
        orderBy: { clauseTemplate: { order: "asc" } },
      },
    },
  });

  const initiatorParty = dealRoom.parties.find(
    (p) => p.role === PartyRole.INITIATOR,
  )!;

  // ── Step 2: Party A selections ──

  const selectionDataA: Array<{
    dealRoomClauseId: string;
    partyId: string;
    optionId: string;
    priority: number;
    flexibility: number;
  }> = [];

  for (const clause of dealRoom.clauses) {
    const sel = selectOptionForParty(
      clause.clauseTemplate.options,
      "A",
      clause.clauseTemplate.order,
    );
    selectionDataA.push({
      dealRoomClauseId: clause.id,
      partyId: initiatorParty.id,
      ...sel,
    });
  }

  await prisma.partySelection.createMany({ data: selectionDataA });

  // ── Step 3: Submit Party A ──

  await prisma.dealRoomParty.update({
    where: { id: initiatorParty.id },
    data: { status: PartyStatus.SUBMITTED, submittedAt: new Date() },
  });

  // ── Step 4: Create Respondent party + Invitation (accepted) ──

  const respondentParty = await prisma.dealRoomParty.create({
    data: {
      dealRoomId: dealRoom.id,
      role: PartyRole.RESPONDENT,
      status: PartyStatus.PENDING,
      email: userB.email,
      name: userB.name,
      company: userB.company,
      userId: userB.id,
    },
  });

  await prisma.invitation.create({
    data: {
      dealRoomId: dealRoom.id,
      email: userB.email,
      sentById: userA.id,
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: new Date(),
    },
  });

  await prisma.dealRoom.update({
    where: { id: dealRoom.id },
    data: { status: DealRoomStatus.AWAITING_RESPONSE },
  });

  // ── Step 5: Party B selections ──

  const selectionDataB: Array<{
    dealRoomClauseId: string;
    partyId: string;
    optionId: string;
    priority: number;
    flexibility: number;
  }> = [];

  for (const clause of dealRoom.clauses) {
    const sel = selectOptionForParty(
      clause.clauseTemplate.options,
      "B",
      clause.clauseTemplate.order,
    );
    selectionDataB.push({
      dealRoomClauseId: clause.id,
      partyId: respondentParty.id,
      ...sel,
    });
  }

  await prisma.partySelection.createMany({ data: selectionDataB });

  // ── Step 6: Submit Party B → both SUBMITTED → NEGOTIATING ──

  await prisma.dealRoomParty.update({
    where: { id: respondentParty.id },
    data: { status: PartyStatus.SUBMITTED, submittedAt: new Date() },
  });

  await prisma.dealRoom.update({
    where: { id: dealRoom.id },
    data: { status: DealRoomStatus.NEGOTIATING },
  });

  // ── Step 7: Run compromise engine ──

  // Build a lookup: dealRoomClauseId → { a, b } selections
  const selByClause = new Map<
    string,
    { a: (typeof selectionDataA)[0]; b: (typeof selectionDataB)[0] }
  >();
  for (const a of selectionDataA) {
    const b = selectionDataB.find(
      (s) => s.dealRoomClauseId === a.dealRoomClauseId,
    )!;
    selByClause.set(a.dealRoomClauseId, { a, b });
  }

  const compromiseInputs: Array<{
    clauseId: string;
    dealRoomClauseId: string;
    clauseTitle: string;
    result: ReturnType<typeof calculateCompromise>;
    options: OptionInput[];
    partyAOptionOrder: number;
    partyBOptionOrder: number;
  }> = [];

  const satisfactions: { a: number; b: number }[] = [];

  for (const clause of dealRoom.clauses) {
    const options: OptionInput[] = clause.clauseTemplate.options.map((o) => ({
      id: o.id,
      order: o.order,
      label: o.label,
      biasPartyA: o.biasPartyA,
      biasPartyB: o.biasPartyB,
    }));

    const sels = selByClause.get(clause.id)!;

    // Both selected the same option → auto-agree
    if (sels.a.optionId === sels.b.optionId) {
      await prisma.dealRoomClause.update({
        where: { id: clause.id },
        data: {
          status: ClauseStatus.AGREED,
          agreedOptionId: sels.a.optionId,
        },
      });
      satisfactions.push({ a: 100, b: 100 });
      continue;
    }

    // Divergent: run compromise
    const initOption = options.find((o) => o.id === sels.a.optionId)!;
    const respOption = options.find((o) => o.id === sels.b.optionId)!;

    const result = calculateCompromise({
      partyASelection: {
        optionId: sels.a.optionId,
        priority: sels.a.priority,
        flexibility: sels.a.flexibility,
        biasPartyA: initOption.biasPartyA,
        biasPartyB: initOption.biasPartyB,
      },
      partyBSelection: {
        optionId: sels.b.optionId,
        priority: sels.b.priority,
        flexibility: sels.b.flexibility,
        biasPartyA: respOption.biasPartyA,
        biasPartyB: respOption.biasPartyB,
      },
      options,
      clauseTitle: clause.clauseTemplate.title,
    });

    compromiseInputs.push({
      clauseId: clause.clauseTemplate.clauseId,
      dealRoomClauseId: clause.id,
      clauseTitle: clause.clauseTemplate.title,
      result,
      options,
      partyAOptionOrder: initOption.order,
      partyBOptionOrder: respOption.order,
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
      })),
    );

    finalResults = compromiseInputs.map((c, i) => ({
      ...c,
      result: fairnessAdjusted[i].result,
    }));
  }

  // ── Step 8: Create CompromiseSuggestion records (both accepted) ──

  for (const item of finalResults) {
    await prisma.dealRoomClause.update({
      where: { id: item.dealRoomClauseId },
      data: {
        status: ClauseStatus.AGREED,
        agreedOptionId: item.result.suggestedOptionId,
      },
    });

    await prisma.compromiseSuggestion.create({
      data: {
        dealRoomClauseId: item.dealRoomClauseId,
        roundNumber: 1,
        suggestedOptionId: item.result.suggestedOptionId,
        satisfactionPartyA: item.result.satisfactionPartyA,
        satisfactionPartyB: item.result.satisfactionPartyB,
        reasoning: item.result.reasoning,
        partyAAccepted: true,
        partyBAccepted: true,
      },
    });

    satisfactions.push({
      a: item.result.satisfactionPartyA,
      b: item.result.satisfactionPartyB,
    });
  }

  // ── Step 9: Finalize → AGREED ──

  await prisma.dealRoom.update({
    where: { id: dealRoom.id },
    data: { status: DealRoomStatus.AGREED },
  });

  // ── Step 10: Add signing details + Sign → COMPLETED ──

  await prisma.dealRoomParty.update({
    where: { id: initiatorParty.id },
    data: {
      signingDetails: {
        legalName: userA.company || "Acme Corp",
        address: "100 Market Street, Suite 300, San Francisco, CA 94105",
        taxId: "94-1234567",
        signatoryName: userA.name || "Alice Johnson",
        signatoryTitle: "Chief Executive Officer",
      },
    },
  });

  await prisma.dealRoomParty.update({
    where: { id: respondentParty.id },
    data: {
      signingDetails: {
        legalName: userB.company || "Widget Inc",
        address: "200 Broadway, Floor 10, New York, NY 10007",
        taxId: "13-7654321",
        signatoryName: userB.name || "Bob Smith",
        signatoryTitle: "Managing Director",
      },
    },
  });

  await prisma.signingRequest.create({
    data: {
      dealRoomId: dealRoom.id,
      provider: "type-to-sign",
      status: "COMPLETED",
      initiatorSignedAt: new Date(),
      respondentSignedAt: new Date(),
      initiatorSignature: userA.name || "Alice Johnson",
      respondentSignature: userB.name || "Bob Smith",
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.dealRoom.update({
    where: { id: dealRoom.id },
    data: { status: DealRoomStatus.COMPLETED },
  });

  const avgA =
    satisfactions.length > 0
      ? Math.round(
          satisfactions.reduce((sum, s) => sum + s.a, 0) /
            satisfactions.length,
        )
      : 100;
  const avgB =
    satisfactions.length > 0
      ? Math.round(
          satisfactions.reduce((sum, s) => sum + s.b, 0) /
            satisfactions.length,
        )
      : 100;

  console.log(`     done  A:${avgA}% B:${avgB}%`);

  return {
    variant,
    dealRoomId: dealRoom.id,
    clauseCount: template.clauses.length,
    expectedClauseCount: template.clauses.length,
    satisfactionA: avgA,
    satisfactionB: avgB,
    status: "COMPLETED",
  };
}

// ── Simulate Solo Deal ────────────────────────────────────────

async function simulateSoloDeal(
  variant: DealVariant,
  userA: { id: string; email: string; name: string | null; company: string | null },
): Promise<SimulationResult> {
  const dealName = `${DEMO_DEAL_PREFIX} ${variant.contractType} (${variant.jurisdiction}/${variant.language})`;

  // Idempotency: skip if deal already exists
  const existing = await prisma.dealRoom.findFirst({
    where: { name: dealName },
  });
  if (existing) {
    console.log(`  skip  "${dealName}" — already exists`);
    const clauseCount = await prisma.dealRoomClause.count({
      where: { dealRoomId: existing.id },
    });
    return {
      variant,
      dealRoomId: existing.id,
      clauseCount,
      expectedClauseCount: clauseCount,
      satisfactionA: 100,
      satisfactionB: 0,
      status: existing.status,
      skipped: true,
    };
  }

  // Find template with clauses + options
  const template = await prisma.contractTemplate.findUnique({
    where: { contractType: variant.contractType },
    include: {
      clauses: {
        include: { options: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!template) {
    throw new Error(`Template not found: ${variant.contractType}`);
  }

  console.log(`  create "${dealName}" (${template.clauses.length} clauses, solo)...`);

  // ── Step 1: Create DealRoom (DRAFT) with initiator party + clauses ──

  const demoParams = DEMO_PARAMETERS[
    variant.language === "es" && DEMO_PARAMETERS[`${variant.contractType}_ES`]
      ? `${variant.contractType}_ES`
      : variant.contractType
  ] || null;

  const dealRoom = await prisma.dealRoom.create({
    data: {
      name: dealName,
      contractTemplateId: template.id,
      governingLaw: variant.jurisdiction,
      contractLanguage: variant.language,
      dealMode: DealMode.SOLO,
      parameters: demoParams || undefined,
      status: DealRoomStatus.DRAFT,
      parties: {
        create: {
          role: PartyRole.INITIATOR,
          status: PartyStatus.PENDING,
          email: userA.email,
          name: userA.name,
          company: userA.company,
          userId: userA.id,
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
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
        orderBy: { clauseTemplate: { order: "asc" } },
      },
    },
  });

  const initiatorParty = dealRoom.parties.find(
    (p) => p.role === PartyRole.INITIATOR,
  )!;

  // ── Step 2: Party A selections ──

  const selectionDataA: Array<{
    dealRoomClauseId: string;
    partyId: string;
    optionId: string;
    priority: number;
    flexibility: number;
  }> = [];

  for (const clause of dealRoom.clauses) {
    const sel = selectOptionForParty(
      clause.clauseTemplate.options,
      "A",
      clause.clauseTemplate.order,
    );
    selectionDataA.push({
      dealRoomClauseId: clause.id,
      partyId: initiatorParty.id,
      ...sel,
    });
  }

  await prisma.partySelection.createMany({ data: selectionDataA });

  // ── Step 3: Submit Party A ──

  await prisma.dealRoomParty.update({
    where: { id: initiatorParty.id },
    data: { status: PartyStatus.SUBMITTED, submittedAt: new Date() },
  });

  // ── Step 4: Auto-agree all clauses with initiator's selections ──

  for (const sel of selectionDataA) {
    await prisma.dealRoomClause.update({
      where: { id: sel.dealRoomClauseId },
      data: {
        status: ClauseStatus.AGREED,
        agreedOptionId: sel.optionId,
      },
    });
  }

  // ── Step 5: Set deal status to AGREED ──

  await prisma.dealRoom.update({
    where: { id: dealRoom.id },
    data: { status: DealRoomStatus.AGREED },
  });

  // ── Step 6: Add signing details (initiator only) ──

  await prisma.dealRoomParty.update({
    where: { id: initiatorParty.id },
    data: {
      signingDetails: {
        legalName: userA.company || "Acme Corp",
        address: "Calle Gran Vía 1, 28013 Madrid",
        taxId: "B12345678",
        signatoryName: userA.name || "Alice Johnson",
        signatoryTitle: "Administrador Único",
      },
    },
  });

  // ── Step 7: Create SigningRequest (initiator signs only) ──

  await prisma.signingRequest.create({
    data: {
      dealRoomId: dealRoom.id,
      provider: "type-to-sign",
      status: "COMPLETED",
      initiatorSignedAt: new Date(),
      initiatorSignature: userA.name || "Alice Johnson",
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  // ── Step 8: Set COMPLETED ──

  await prisma.dealRoom.update({
    where: { id: dealRoom.id },
    data: { status: DealRoomStatus.COMPLETED },
  });

  console.log(`     done  A:100% (solo)`);

  return {
    variant,
    dealRoomId: dealRoom.id,
    clauseCount: template.clauses.length,
    expectedClauseCount: template.clauses.length,
    satisfactionA: 100,
    satisfactionB: 0,
    status: "COMPLETED",
  };
}

// ── Contract Validation (inlined from generator.ts) ───────────

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
    es: "Reino de Espana",
  },
};

async function validateContract(
  dealRoomId: string,
  expectedClauseCount: number,
  hasBoilerplate: boolean,
  language: string,
  isSolo?: boolean,
): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  const deal = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: {
      contractTemplate: true,
      parties: true,
      clauses: {
        include: {
          clauseTemplate: {
            include: { options: true },
          },
        },
        orderBy: { clauseTemplate: { order: "asc" } },
      },
    },
  });

  // 1. Contract data is non-null
  checks.push({ name: "Contract data non-null", passed: deal !== null });
  if (!deal) return checks;

  const initiator = deal.parties.find((p) => p.role === "INITIATOR");
  const respondent = deal.parties.find((p) => p.role === "RESPONDENT");

  const partyAName =
    initiator?.company || initiator?.name || initiator?.email || "";
  const partyBName =
    respondent?.company || respondent?.name || respondent?.email || "";

  // 2. Party A name present and not a placeholder
  checks.push({
    name: "Party A name present",
    passed: partyAName.length > 0 && !partyAName.includes("["),
    detail: partyAName,
  });

  // 3. Party B name present and not a placeholder (skip for solo deals)
  if (!isSolo) {
    checks.push({
      name: "Party B name present",
      passed: partyBName.length > 0 && !partyBName.includes("["),
      detail: partyBName,
    });
  }

  // 4. Party A company present
  checks.push({
    name: "Party A company present",
    passed: !!initiator?.company && initiator.company.length > 0,
  });

  // 5. Party B company present (skip for solo deals)
  if (!isSolo) {
    checks.push({
      name: "Party B company present",
      passed: !!respondent?.company && respondent.company.length > 0,
    });
  }

  // Compile agreed clauses (mirrors generator.ts logic)
  const lang = deal.contractLanguage || "en";
  const agreedClauses: Array<{
    title: string;
    legalText: string;
    agreedOption: string;
  }> = [];

  for (const clause of deal.clauses) {
    if (clause.status !== "AGREED" || !clause.agreedOptionId) continue;

    const ctLocalized = clause.clauseTemplate.localizedContent as Record<
      string,
      Record<string, string>
    > | null;
    const clauseTitle = ctLocalized?.title
      ? resolveLocalizedString(ctLocalized.title, lang)
      : clause.clauseTemplate.title;

    const agreedOption = clause.clauseTemplate.options.find(
      (opt) => opt.id === clause.agreedOptionId,
    );
    if (!agreedOption) continue;

    const optLocalized = agreedOption.localizedContent as Record<
      string,
      unknown
    > | null;
    const legalText = optLocalized?.legalText
      ? resolveLocalizedString(optLocalized.legalText, lang)
      : agreedOption.legalText;
    const optionLabel = optLocalized?.label
      ? resolveLocalizedString(optLocalized.label, lang)
      : agreedOption.label;

    agreedClauses.push({ title: clauseTitle, legalText, agreedOption: optionLabel });
  }

  // 6. All clauses have non-empty legal text (>20 chars)
  const shortTexts = agreedClauses.filter((c) => c.legalText.length <= 20);
  checks.push({
    name: "All clauses have legal text >20 chars",
    passed: shortTexts.length === 0,
    detail:
      shortTexts.length > 0
        ? `${shortTexts.length} clause(s) too short`
        : undefined,
  });

  // 7. All clauses have non-empty titles
  const emptyTitles = agreedClauses.filter((c) => c.title.length === 0);
  checks.push({
    name: "All clauses have titles",
    passed: emptyTitles.length === 0,
    detail:
      emptyTitles.length > 0
        ? `${emptyTitles.length} missing title(s)`
        : undefined,
  });

  // 8. Clause count matches template
  checks.push({
    name: "Clause count matches template",
    passed: agreedClauses.length === expectedClauseCount,
    detail: `${agreedClauses.length}/${expectedClauseCount}`,
  });

  // Process boilerplate (mirrors generator.ts processBoilerplate)
  const rawBp = deal.contractTemplate.boilerplate as Record<
    string,
    unknown
  > | null;
  let preambleText = "";

  if (rawBp) {
    const effectiveDate = deal.createdAt.toLocaleDateString(
      lang === "es" ? "es-ES" : "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );
    const paramSchema = deal.contractTemplate.parameterSchema as ParameterSchema | null;
    const dealParams = (deal.parameters as Record<string, string>) || {};
    const paramVars = buildBoilerplateVariables(dealParams, paramSchema);
    const sdA = initiator?.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;
    const sdB = respondent?.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;
    const vars: Record<string, string> = {
      effectiveDate,
      partyAName: sdA?.legalName || partyAName,
      partyBName: sdB?.legalName || partyBName,
      partyAAddress: sdA?.address || "[Address]",
      partyBAddress: sdB?.address || "[Address]",
      partyAId: sdA?.taxId || "",
      partyBId: sdB?.taxId || "",
      partyAShortName: "Party A",
      partyBShortName: "Party B",
      ...paramVars,
    };
    const interpolate = (val: unknown): string => {
      const resolved = resolveLocalizedString(val, lang);
      return resolved.replace(
        /\{(\w+)\}/g,
        (match, key) => vars[key as string] !== undefined ? vars[key as string] : match,
      );
    };
    preambleText = interpolate(rawBp.preamble);
  }

  // 9. Boilerplate present (for templates that have it)
  if (hasBoilerplate) {
    checks.push({
      name: "Boilerplate present",
      passed: rawBp !== null,
    });
  }

  // 10. Preamble non-empty (when boilerplate exists)
  if (hasBoilerplate) {
    checks.push({
      name: "Preamble non-empty",
      passed: preambleText.length > 0,
      detail: `${preambleText.length} chars`,
    });
  }

  // 11. No unresolved {variable} placeholders in text fields
  const allTexts = [
    ...agreedClauses.map((c) => c.legalText),
    ...agreedClauses.map((c) => c.title),
    preambleText,
  ];
  const unresolvedVars: string[] = [];
  for (const text of allTexts) {
    let m: RegExpExecArray | null;
    const re = /\{(\w+)\}/g;
    while ((m = re.exec(text)) !== null) {
      unresolvedVars.push(m[1]);
    }
  }
  const uniqueUnresolved = Array.from(new Set(unresolvedVars));
  checks.push({
    name: "No unresolved {variable} placeholders",
    passed: uniqueUnresolved.length === 0,
    detail:
      uniqueUnresolved.length > 0
        ? `Found: {${uniqueUnresolved.join("}, {")}}`
        : undefined,
  });

  // 12. Governing law display string is non-empty
  const govLawDisplay =
    GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[lang] ||
    GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
    "";
  checks.push({
    name: "Governing law display non-empty",
    passed: govLawDisplay.length > 0,
    detail: govLawDisplay,
  });

  // 13. Language matches expected value
  checks.push({
    name: "Language matches expected",
    passed: deal.contractLanguage === language,
    detail: `expected=${language}, actual=${deal.contractLanguage}`,
  });

  // 14. Date is valid
  checks.push({
    name: "Date is valid",
    passed:
      deal.createdAt instanceof Date && !isNaN(deal.createdAt.getTime()),
  });

  return checks;
}

// ── Report ────────────────────────────────────────────────────

function printReport(
  results: SimulationResult[],
  validations: ValidationResult[],
): boolean {
  console.log("\n" + "=".repeat(90));
  console.log("  Deal Simulation Report");
  console.log("=".repeat(90));

  const activeCount = results.filter((r) => !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const templateCount = new Set(results.map((r) => r.variant.contractType)).size;

  console.log(
    `\n  Templates: ${templateCount} | Deals: ${results.length} (${activeCount} created, ${skippedCount} skipped)\n`,
  );

  console.log(
    "   #  | Contract              | Jurisdiction   | Lang | Clauses | Satisfaction  | Status",
  );
  console.log("  " + "-".repeat(87));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const num = String(i + 1).padStart(2);
    const contract = r.variant.contractType.padEnd(21);
    const juris = r.variant.jurisdiction.padEnd(14);
    const lang = r.variant.language.padEnd(4);
    const clauses = `${r.clauseCount}/${r.expectedClauseCount}`.padEnd(7);
    const isSolo = r.variant.dealMode === "SOLO";
    const sat = r.skipped
      ? "-".padEnd(13)
      : isSolo
        ? `A:100% (solo)`.padEnd(13)
        : `A:${r.satisfactionA}% B:${r.satisfactionB}%`.padEnd(13);
    const status = r.skipped ? `${r.status} (skipped)` : r.status;
    console.log(
      `   ${num} | ${contract} | ${juris} | ${lang} | ${clauses} | ${sat} | ${status}`,
    );
  }

  console.log("\n  Validation:");
  console.log("  " + "-".repeat(87));

  for (let i = 0; i < validations.length; i++) {
    const v = validations[i];
    const num = String(i + 1).padStart(2);
    const label =
      `${v.variant.contractType} (${v.variant.jurisdiction}/${v.variant.language})`.padEnd(
        35,
      );
    const passed = v.checks.filter((c) => c.passed).length;
    const total = v.checks.length;
    const status = v.allPassed ? "PASS" : "WARN";
    const failedNames = v.checks
      .filter((c) => !c.passed)
      .map((c) => c.name);
    const failStr =
      failedNames.length > 0 ? ` -- ${failedNames.join(", ")}` : "";
    console.log(
      `   ${num} | ${label} | ${status} | ${passed}/${total} checks${failStr}`,
    );
  }

  console.log("\n" + "=".repeat(90));

  const allPassed = validations.every((v) => v.allPassed);
  if (allPassed) {
    console.log("\n  All validation checks passed.\n");
  } else {
    console.log("\n  Some validation checks failed.\n");
  }

  return allPassed;
}

// ── Main ──────────────────────────────────────────────────────

async function main(): Promise<boolean> {
  const args = process.argv.slice(2);
  const clean = args.includes("--clean");

  console.log("Deal Simulator");
  console.log(
    `  Mode: ${clean ? "clean (recreating all)" : "idempotent (skip existing)"}\n`,
  );

  // Clean mode: delete existing demo deals
  if (clean) {
    const existing = await prisma.dealRoom.findMany({
      where: { name: { startsWith: DEMO_DEAL_PREFIX } },
      select: { id: true, name: true },
    });
    if (existing.length > 0) {
      console.log(`  Deleting ${existing.length} existing demo deals...`);
      // Delete signing requests first (FK constraint)
      await prisma.signingRequest.deleteMany({
        where: { dealRoomId: { in: existing.map((e) => e.id) } },
      });
      await prisma.dealRoom.deleteMany({
        where: { name: { startsWith: DEMO_DEAL_PREFIX } },
      });
    }
  }

  // Ensure demo users
  console.log("Ensuring demo users...");
  const { userA, userB } = await ensureDemoUsers();
  console.log(`  Alice: ${userA.email} (${userA.id})`);
  console.log(`  Bob:   ${userB.email} (${userB.id})\n`);

  // Run simulations
  console.log("Simulating deals...\n");
  const results: SimulationResult[] = [];

  for (const variant of DEAL_VARIANTS) {
    try {
      const result = variant.dealMode === "SOLO"
        ? await simulateSoloDeal(variant, userA)
        : await simulateDeal(variant, userA, userB);
      results.push(result);
    } catch (err) {
      console.error(
        `  FAILED: ${variant.contractType} (${variant.jurisdiction}/${variant.language})`,
        err,
      );
      results.push({
        variant,
        dealRoomId: "",
        clauseCount: 0,
        expectedClauseCount: 0,
        satisfactionA: 0,
        satisfactionB: 0,
        status: "FAILED",
      });
    }
  }

  // Run validations
  console.log("\nValidating contracts...\n");
  const validations: ValidationResult[] = [];

  for (const result of results) {
    if (!result.dealRoomId || result.status === "FAILED") {
      validations.push({
        variant: result.variant,
        checks: [{ name: "Deal exists", passed: false }],
        allPassed: false,
      });
      continue;
    }

    const checks = await validateContract(
      result.dealRoomId,
      result.expectedClauseCount,
      result.variant.hasBoilerplate,
      result.variant.language,
      result.variant.dealMode === "SOLO",
    );

    validations.push({
      variant: result.variant,
      checks,
      allPassed: checks.every((c) => c.passed),
    });
  }

  return printReport(results, validations);
}

let exitCode = 0;

main()
  .then((allPassed) => {
    exitCode = allPassed ? 0 : 1;
  })
  .catch((e) => {
    console.error("Fatal error:", e);
    exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(exitCode);
  });
