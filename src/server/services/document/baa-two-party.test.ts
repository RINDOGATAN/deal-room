// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The BAA (BAA_NEGOTIATOR) as a two-party agreement (6 October 2026).
 *
 * The real hosted skill (boilerplate, parameters and clauses) is run through
 * the real generator: the preamble names both parties under their roles,
 * the services and the underlying agreement reach the Background, the venue
 * input fills Section 21(c), no bracket is left unfilled, "exclusive" is
 * not doubled, and the two PHI postures each render every section once.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), "prisma/hosted-skills/baa-negotiator");
const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f), "utf8"));
const boilerplate = read("boilerplate.json");
const parameters = read("parameters.json");
const skill = read("clauses.json") as {
  clauses: Array<{
    id: string;
    order: number;
    title: { en: string };
    category: { en: string };
    options: Array<{ id: string; code: string; label: { en: string }; legalText: { en: string } }>;
  }>;
};

let currentDeal: unknown = null;
vi.mock("@/lib/prisma", () => ({
  default: {
    dealRoom: { findUnique: vi.fn(async () => currentDeal) },
    agentDealRoom: { findFirst: vi.fn(async () => null) },
  },
}));

import { generateContractData } from "./generator";
import { generateContractTxt } from "./contractTxt";
import { withDefaults } from "@/server/services/agent/generateContract";
import type { ParameterSchema } from "@/lib/parameters";

const VENDOR = {
  role: "INITIATOR",
  name: "Vera Vendor",
  email: "vera@vendor.example",
  company: "Vendor Software Inc.",
  signingDetails: {
    legalName: "Vendor Software Inc.",
    address: "1 Main Street, Los Angeles, CA",
    signatoryName: "Vera Vendor",
    signatoryTitle: "CEO",
  },
};
const CLINIC = {
  role: "RESPONDENT",
  name: "Carl Clinic",
  email: "carl@clinic.example",
  company: "Clinic Health LLC",
  signingDetails: {
    legalName: "Clinic Health LLC",
    address: "5 Oak Avenue, San Diego, CA",
    signatoryName: "Carl Clinic",
    signatoryTitle: "Privacy Officer",
  },
};

const TERMS = {
  "services-description": "hosted contract drafting software and related support",
  "underlying-agreement": "the Master Services Agreement dated 1 March 2026",
};

/** Every clause agreed on its first option, as a one-call deal with no choices settles it. */
function agreedClauses() {
  return skill.clauses.map((c) => ({
    status: "AGREED",
    agreedOptionId: `opt-${c.id}-0`,
    selections: [],
    clauseTemplate: {
      clauseId: c.id,
      title: c.title.en,
      category: c.category.en,
      order: c.order,
      localizedContent: null,
      options: c.options.map((o, i) => ({
        id: `opt-${c.id}-${i}`,
        code: o.code,
        label: o.label.en,
        legalText: o.legalText.en,
        localizedContent: null,
      })),
    },
  }));
}

function buildDeal(opts: { params?: Record<string, string>; fillRole?: string } = {}) {
  return {
    id: "deal-baa",
    name: "BAA",
    dealMode: "NEGOTIATION",
    contractLanguage: "en",
    governingLaw: "CALIFORNIA",
    createdAt: new Date("2026-10-06T00:00:00Z"),
    parameters: opts.params ?? TERMS,
    soloFillRole: opts.fillRole ?? "BUSINESS_ASSOCIATE",
    contractTemplate: {
      displayName: "Business Associate Agreement (HIPAA)",
      contractType: "BAA_NEGOTIATOR",
      boilerplate,
      parameterSchema: parameters,
    },
    parties: [VENDOR, CLINIC],
    signingRequest: null,
    clauses: agreedClauses(),
  };
}

async function render(opts: Parameters<typeof buildDeal>[0] = {}) {
  currentDeal = buildDeal(opts);
  const data = (await generateContractData("deal-baa"))!;
  expect(data).not.toBeNull();
  return { data, txt: generateContractTxt(data) };
}

/** The section numbers in the order the agreement shows them. */
function sectionNumbers(txt: string): number[] {
  return [...txt.matchAll(/^(\d+)\. [A-Z]/gm)].map((m) => Number(m[1]));
}

const ALL_SECTIONS = Array.from({ length: 21 }, (_, i) => i + 1);

beforeEach(() => {
  currentDeal = null;
});

describe("the BAA names both parties", () => {
  it("puts the business associate and the covered entity in the preamble, each under its role", async () => {
    const { data } = await render();
    const pre = data.boilerplate!.preamble;
    expect(pre).toContain('Vendor Software Inc. ("Company"), as business associate');
    expect(pre).toContain('Clinic Health LLC ("Customer"), as covered entity');
    expect(pre).not.toContain("the customer agreeing to the terms below");
  });

  it("follows the role chosen: a covered-entity initiator lands as Customer", async () => {
    currentDeal = { ...buildDeal({ fillRole: "COVERED_ENTITY" }), parties: [{ ...CLINIC, role: "INITIATOR" }, { ...VENDOR, role: "RESPONDENT" }] };
    const data = (await generateContractData("deal-baa"))!;
    const pre = data.boilerplate!.preamble;
    expect(pre).toContain('Vendor Software Inc. ("Company"), as business associate');
    expect(pre).toContain('Clinic Health LLC ("Customer"), as covered entity');
  });
});

describe("the BAA inputs reach the text", () => {
  it("carries the services and the underlying agreement, with no bracket and no doubled 'exclusive'", async () => {
    const { data, txt } = await render();
    expect(data.boilerplate!.background).toContain(
      'Company provides hosted contract drafting software and related support (the "Services") to Customer under the Master Services Agreement dated 1 March 2026',
    );
    expect(txt).toContain("the Master Services Agreement dated 1 March 2026");
    expect(txt).not.toMatch(/\[[^\]]*\]/);
    expect(txt).not.toMatch(/\{\w+\}/);
    for (const sentence of txt.split(/(?<=\.)\s/)) {
      expect(sentence.match(/\bexclusive\b/g)?.length ?? 0, sentence).toBeLessThan(2);
    }
  });

  it("falls back to the Underlying Agreement's forum, then the California courts, when no venue is given", async () => {
    const { txt } = await render();
    expect(txt).toContain(
      "For any action arising out of or relating to this Agreement, the parties consent to the exclusive jurisdiction of the court or arbitration forum designated for disputes in the Underlying Agreement or, if the Underlying Agreement designates none, the state and federal courts located in the State of California, and waive any objection to venue in that forum.",
    );
  });

  it("uses the venue when one is given", async () => {
    const { txt } = await render({
      params: { ...TERMS, "dispute-venue": "the state and federal courts located in Los Angeles County, California" },
    });
    expect(txt).toContain(
      "the parties consent to the exclusive jurisdiction of the state and federal courts located in Los Angeles County, California, and waive any objection to venue in that forum.",
    );
    expect(txt).not.toContain("designated for disputes in the Underlying Agreement");
  });

  it("an older deal with no inputs keeps the general wording and leaves no variable unfilled", async () => {
    const { data, txt } = await render({ params: {} });
    expect(data.boilerplate!.background).toContain(
      'Company provides services ("Services") to Customer under one or more agreements (each an "Underlying Agreement").',
    );
    expect(txt).not.toMatch(/\{\w+\}/);
    expect(txt).toContain("as a precautionary measure");
  });
});

describe("the two PHI postures", () => {
  it("springing by default: precautionary wording, every section once", async () => {
    const { txt } = await render();
    expect(txt).toContain("The Services are not designed to, and do not require,");
    expect(txt).toContain("as a precautionary measure");
    expect(txt).toContain("2. NO PHI TO BE TRANSMITTED");
    expect(sectionNumbers(txt)).toEqual(ALL_SECTIONS);
  });

  it("conventional when the services are designed to handle PHI: no springing wording, every section once", async () => {
    const { txt } = await render({ params: { ...TERMS, "phi-by-design": "yes" } });
    expect(txt).toContain("In providing the Services, Company creates, receives, maintains, or transmits Protected Health Information");
    expect(txt).toContain("Company may use or disclose PHI as necessary to perform the Services");
    expect(txt).toContain("2. SCOPE OF PHI");
    expect(txt).not.toContain("precautionary");
    expect(txt).not.toContain("The Services are not designed to");
    expect(txt).not.toContain("Customer acknowledges that the Services are not designed");
    expect(sectionNumbers(txt)).toEqual(ALL_SECTIONS);
  });

  it("the one call writes a choice sent in another case as the listed option", () => {
    const terms = withDefaults({ "phi-by-design": " Yes " }, parameters as ParameterSchema, "CALIFORNIA");
    expect(terms["phi-by-design"]).toBe("yes");
    expect(withDefaults({}, parameters as ParameterSchema, "CALIFORNIA")["phi-by-design"]).toBe("no");
  });
});
