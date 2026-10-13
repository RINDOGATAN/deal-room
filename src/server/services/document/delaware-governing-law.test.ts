// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Delaware Certificate of Incorporation is governed by Delaware law
 * (the DGCL): the real skill run through the real generator under DELAWARE
 * names Delaware as the governing law and never California.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), "skills/delaware-certificate-of-incorporation");
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

function buildDeal() {
  return {
    id: "deal-de",
    name: "Certificate of Incorporation",
    dealMode: "SOLO",
    contractLanguage: "en",
    governingLaw: "DELAWARE",
    createdAt: new Date("2026-10-12T00:00:00Z"),
    parameters: {
      "company-name": "Example Labs, Inc.",
      "registered-agent": "Example Agent Inc., 1 Example Street, Dover, DE 19901",
      "par-value": "0.00001",
      incorporator: "Alex Founder",
    },
    soloFillRole: null,
    contractTemplate: {
      displayName: "Certificate of Incorporation (Delaware C-Corp)",
      contractType: "DELAWARE_CERT_OF_INCORPORATION",
      boilerplate,
      parameterSchema: parameters,
    },
    parties: [
      {
        role: "INITIATOR",
        name: "Alex Founder",
        email: "alex@example.com",
        company: "Example Labs, Inc.",
        signingDetails: { legalName: "Alex Founder", signatoryName: "Alex Founder" },
      },
    ],
    signingRequest: null,
    clauses: skill.clauses.map((c) => ({
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
    })),
  };
}

describe("the Delaware Certificate of Incorporation", () => {
  it("names Delaware as the governing law, never California", async () => {
    currentDeal = buildDeal();
    const data = (await generateContractData("deal-de"))!;
    expect(data).not.toBeNull();
    expect(data.governingLaw).toBe("State of Delaware, United States of America");
    const txt = generateContractTxt(data);
    expect(txt).toContain("State of Delaware, United States of America");
    expect(txt).not.toMatch(/California/i);
  });
});
