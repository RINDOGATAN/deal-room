// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Party details in a generated contract, on the real NDA skill: a one-call
 * agent contract whose filling side gave only a legal name, and whose other
 * side gave a legal name, an address and a jurisdiction of incorporation.
 *
 * Regression for a recorded session (2026-10-13): the account e-mail was
 * written as Party A's contact and as the Name of a second, duplicated
 * signature block; the other side's contact line repeated its legal name;
 * and the other side's seat never reached the contract.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ndaBoilerplate = JSON.parse(
  readFileSync(resolve(process.cwd(), "skills/nda/boilerplate.json"), "utf8"),
);
const ndaParameters = JSON.parse(
  readFileSync(resolve(process.cwd(), "skills/nda/parameters.json"), "utf8"),
);

let currentDeal: unknown = null;
vi.mock("@/lib/prisma", () => ({
  default: {
    dealRoom: { findUnique: vi.fn(async () => currentDeal) },
    agentDealRoom: { findFirst: vi.fn(async () => null) },
  },
}));

import { generateContractData } from "./generator";
import { generateContractMarkdown } from "./contractMarkdown";
import { generateContractHtml } from "./contractHtml";
import { generateContractTxt } from "./contractTxt";

const ACCOUNT_EMAIL = "owner@account.example";

function soloNda(language: "en" | "es", counterparty: Record<string, string> | null) {
  return {
    id: "deal-1",
    name: "NDA",
    dealMode: "SOLO",
    contractLanguage: language,
    governingLaw: "CALIFORNIA",
    createdAt: new Date("2026-10-13T00:00:00Z"),
    parameters: {},
    soloFillRole: null,
    soloCounterparty: counterparty,
    contractTemplate: {
      displayName: "Non-Disclosure Agreement",
      contractType: "NDA",
      boilerplate: ndaBoilerplate,
      parameterSchema: ndaParameters,
    },
    // As the one-call intake stores it: the account e-mail on the party
    // row, no person's name, only the legal name in the signing details.
    parties: [
      {
        role: "INITIATOR",
        name: null,
        email: ACCOUNT_EMAIL,
        company: "Demo Company A",
        signingDetails: { legalName: "Demo Company A" },
      },
    ],
    signingRequest: null,
    clauses: [],
  };
}

const SUPPLIER = {
  legalName: "Demo Supplier B",
  address: "Calle Mayor 1, 28013 Madrid, Spain",
  jurisdiction: "Spain",
};

beforeEach(() => {
  currentDeal = null;
});

describe("party details in a one-call NDA", () => {
  for (const language of ["en", "es"] as const) {
    it(`${language}: no account e-mail, one signature block per party, the other side's seat`, async () => {
      currentDeal = soloNda(language, SUPPLIER);
      const data = (await generateContractData("deal-1"))!;
      for (const [format, text] of [
        ["md", generateContractMarkdown(data)],
        ["html", generateContractHtml(data)],
        ["txt", generateContractTxt(data)],
      ] as const) {
        expect(text, format).not.toContain(ACCOUNT_EMAIL);
        // One block per party: each "For and on behalf of" appears once.
        const forA = language === "es" ? "Demo Company A" : "For and on behalf of Demo Company A";
        expect(text.split(forA).length - 1, `${format} party A block`).toBeGreaterThanOrEqual(1);
        expect(text, format).toContain("Calle Mayor 1, 28013 Madrid, Spain");
      }
      const md = generateContractMarkdown(data);
      // No structured block after the template's own signature text.
      expect(md).not.toMatch(/### Disclosing Party\n/);
      expect(md).not.toMatch(/### Parte Divulgante\n/);
      // The contact line is never the legal name repeated.
      expect(md).not.toContain("Demo Supplier B\n- **Contact");
      expect(md).not.toMatch(/\*\*(Contact|Contacto):\*\* Demo Supplier B/);
      expect(md).toMatch(/\*\*(Jurisdiction of incorporation|Lugar de constitución):\*\* Spain/);
      // The preamble carries the supplier's seat.
      expect(data.boilerplate!.preamble).toContain("Calle Mayor 1, 28013 Madrid, Spain");
    });
  }

  it("signature names stay blank when no signatory was given", async () => {
    currentDeal = soloNda("en", SUPPLIER);
    const data = (await generateContractData("deal-1"))!;
    expect(data.partyA.signatoryName).toBeUndefined();
    expect(data.partyB?.signatoryName).toBeUndefined();
    expect(data.partyA.name).toBe("Demo Company A");
    expect(data.partyA.contact).toBeUndefined();
    expect(data.partyB?.contact).toBeUndefined();
    const sig = data.boilerplate!.signatureBlock;
    expect(sig.match(/For and on behalf of/g)).toHaveLength(2);
    expect(sig).not.toContain(ACCOUNT_EMAIL);
    expect(sig).not.toContain("Name: Demo Supplier B");
  });

  it("Spanish: signature blocks in Spanish, one full stop after EE.UU.", async () => {
    const deal = soloNda("es", SUPPLIER);
    deal.clauses = [
      {
        status: "AGREED",
        agreedOptionId: "opt-delaware",
        selections: [],
        clauseTemplate: {
          clauseId: "dispute-resolution",
          title: "Governing law and jurisdiction",
          category: "Legal",
          order: 5,
          localizedContent: { title: { en: "Governing law and jurisdiction", es: "Ley aplicable y jurisdicción" } },
          options: [
            {
              id: "opt-delaware",
              code: "courts-delaware",
              label: "Delaware courts",
              legalText: "Delaware.",
              localizedContent: { legalText: { en: "Delaware.", es: "Toda controversia se resolverá en Delaware." } },
            },
          ],
        },
      },
    ] as never[];
    currentDeal = deal;
    const data = (await generateContractData("deal-1"))!;
    expect(data.governingLawArticle?.text).toContain("Estado de California, EE.UU. Toda controversia");
    for (const text of [generateContractMarkdown(data), generateContractTxt(data), generateContractHtml(data)]) {
      expect(text).not.toContain("For and on behalf of");
      expect(text).not.toMatch(/\bSignature:|\bTitle:/);
      expect(text).toContain("En nombre y representación de Demo Company A:");
      expect(text).toContain("Firma: ");
      expect(text).toContain("Cargo: ");
      expect(text).not.toContain("EE.UU..");
    }
  });

  it("uses a supplied contact and signatory", async () => {
    currentDeal = soloNda("en", { ...SUPPLIER, contact: "Ana García, legal@supplier.example", signatoryName: "Ana García", signatoryTitle: "Administradora" });
    const data = (await generateContractData("deal-1"))!;
    const md = generateContractMarkdown(data);
    expect(md).toContain("- **Contact:** Ana García, legal@supplier.example");
    expect(md).toContain("Name: Ana García");
    expect(md).toContain("Title: Administradora");
  });

  it("without the other side's details its block stays blank", async () => {
    currentDeal = soloNda("en", null);
    const data = (await generateContractData("deal-1"))!;
    const txt = generateContractTxt(data);
    expect(txt).not.toContain(ACCOUNT_EMAIL);
    expect(txt).toContain("[Address]");
  });
});
