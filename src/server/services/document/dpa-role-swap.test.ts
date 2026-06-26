import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";

// ── Real skill data (boilerplate + parameter schema) ──────────────────────
// We feed the actual DPA skill JSON through the real generator so the swap is
// exercised against production boilerplate, not a hand-crafted stand-in.
const dpaBoilerplate = JSON.parse(
  readFileSync(resolve(process.cwd(), "skills/dpa/boilerplate.json"), "utf8"),
);
const dpaParameters = JSON.parse(
  readFileSync(resolve(process.cwd(), "skills/dpa/parameters.json"), "utf8"),
);

// ── prisma mock ───────────────────────────────────────────────────────────
// generateContractData reads exactly two tables: dealRoom.findUnique and
// agentDealRoom.findFirst. We control the deal returned per-test via `currentDeal`.
let currentDeal: unknown = null;
vi.mock("@/lib/prisma", () => ({
  default: {
    dealRoom: { findUnique: vi.fn(async () => currentDeal) },
    agentDealRoom: { findFirst: vi.fn(async () => null) },
  },
}));

// Imported AFTER the mock is registered.
import { generateContractData } from "./generator";
import { generateContractTxt } from "./contractTxt";
import { ContractPDF } from "./ContractPDF";

const INITIATOR = {
  role: "INITIATOR",
  name: "Ada Processor",
  email: "ada@acme.example",
  company: "Acme Processing SL",
  signingDetails: {
    legalName: "Acme Processing SL",
    address: "1 Calle Mayor, Madrid",
    taxId: "ESB-ACME",
    signatoryName: "Ada Processor",
    signatoryTitle: "CTO",
  },
};
const RESPONDENT = {
  role: "RESPONDENT",
  name: "Cyril Controller",
  email: "cyril@globex.example",
  company: "Globex Controller GmbH",
  signingDetails: {
    legalName: "Globex Controller GmbH",
    address: "5 Hauptstrasse, Berlin",
    taxId: "DE-GLOBEX",
    signatoryName: "Cyril Controller",
    signatoryTitle: "DPO",
  },
};

function buildTwoPartyDpa(soloFillRole: "CONTROLLER" | "PROCESSOR") {
  return {
    id: "deal-1",
    name: "Acme ↔ Globex DPA",
    dealMode: "NEGOTIATION",
    contractLanguage: "en",
    governingLaw: "SPAIN",
    createdAt: new Date("2026-06-26T00:00:00Z"),
    parameters: {},
    soloFillRole,
    contractTemplate: {
      displayName: "Data Processing Agreement",
      contractType: "DPA",
      boilerplate: dpaBoilerplate,
      parameterSchema: dpaParameters,
    },
    parties: [INITIATOR, RESPONDENT],
    signingRequest: {
      initiatorSignature: "Ada Processor",
      initiatorSignedAt: new Date("2026-06-26T10:00:00Z"),
      respondentSignature: "Cyril Controller",
      respondentSignedAt: new Date("2026-06-26T11:00:00Z"),
    },
    clauses: [],
  };
}

// Solo: a single filling party, no respondent. The other role's block is left
// blank in the output for the counterparty to complete offline.
function buildSoloDpa(soloFillRole: "CONTROLLER" | "PROCESSOR") {
  return {
    ...buildTwoPartyDpa(soloFillRole),
    dealMode: "SOLO",
    parties: [INITIATOR],
    signingRequest: {
      initiatorSignature: "Ada Processor",
      initiatorSignedAt: new Date("2026-06-26T10:00:00Z"),
      respondentSignature: null,
      respondentSignedAt: null,
    },
  };
}

const BLANK = "[_________________]";

beforeEach(() => {
  currentDeal = null;
});

describe("two-party DPA Controller/Processor swap", () => {
  it("PROCESSOR initiator: respondent → Controller slot, initiator → Processor slot", async () => {
    currentDeal = buildTwoPartyDpa("PROCESSOR");
    const data = (await generateContractData("deal-1"))!;
    expect(data).not.toBeNull();

    // Party A is the Controller slot (partyLabels.partyA === "Controller").
    // After the swap the initiator (processor) must NOT be there.
    expect(data.partyA.company).toBe("Globex Controller GmbH");
    expect(data.partyB?.company).toBe("Acme Processing SL");

    // Each party keeps its own signature in its new slot.
    expect(data.partyA.signature).toBe("Cyril Controller");
    expect(data.partyB?.signature).toBe("Ada Processor");

    // Cover-page names follow the same swapped slots.
    expect(data.coverPartyAName).toContain("Globex");
    expect(data.coverPartyBName).toContain("Acme");

    // The REAL processed preamble places the right company under each role.
    const pre = data.boilerplate!.preamble;
    expect(pre.indexOf("DATA CONTROLLER")).toBeLessThan(pre.indexOf("Globex"));
    expect(pre.indexOf("Globex")).toBeLessThan(pre.indexOf("DATA PROCESSOR"));
    expect(pre.indexOf("DATA PROCESSOR")).toBeLessThan(pre.indexOf("Acme"));
  });

  it("CONTROLLER initiator (default/no swap): initiator stays Controller", async () => {
    currentDeal = buildTwoPartyDpa("CONTROLLER");
    const data = (await generateContractData("deal-1"))!;

    expect(data.partyA.company).toBe("Acme Processing SL");
    expect(data.partyB?.company).toBe("Globex Controller GmbH");
    expect(data.partyA.signature).toBe("Ada Processor");
    expect(data.partyB?.signature).toBe("Cyril Controller");

    const pre = data.boilerplate!.preamble;
    expect(pre.indexOf("DATA CONTROLLER")).toBeLessThan(pre.indexOf("Acme"));
    expect(pre.indexOf("Acme")).toBeLessThan(pre.indexOf("DATA PROCESSOR"));
    expect(pre.indexOf("DATA PROCESSOR")).toBeLessThan(pre.indexOf("Globex"));
  });

  it("TXT (same ContractData the PDF renders): role labels map to the swapped parties", async () => {
    currentDeal = buildTwoPartyDpa("PROCESSOR");
    const data = (await generateContractData("deal-1"))!;
    const txt = generateContractTxt(data);

    // Parties + signature sections label the slots "Controller" / "Processor".
    expect(txt).toMatch(/Controller:\n\s+Globex Controller GmbH/);
    expect(txt).toMatch(/Processor:\n\s+Acme Processing SL/);
    // The processor (initiator) must never appear under the Controller label.
    expect(txt).not.toMatch(/Controller:\n\s+Acme Processing SL/);
  });

  it("PDF: renders the swapped two-party data to a valid, non-empty document", async () => {
    currentDeal = buildTwoPartyDpa("PROCESSOR");
    const data = (await generateContractData("deal-1"))!;
    const buf = await renderToBuffer(ContractPDF({ data }) as never);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("solo DPA Controller/Processor fill", () => {
  it("PROCESSOR: filling party → Processor slot, Controller slot left blank", async () => {
    currentDeal = buildSoloDpa("PROCESSOR");
    const data = (await generateContractData("deal-1"))!;

    // Controller slot (Party A) blank; filling party moves into Processor (B).
    expect(data.partyA.name).toBe(BLANK);
    expect(data.partyB?.company).toBe("Acme Processing SL");
    expect(data.partyB?.signature).toBe("Ada Processor");
    expect(data.coverPartyAName).toBe(BLANK);
    expect(data.coverPartyBName).toContain("Acme");

    const pre = data.boilerplate!.preamble;
    expect(pre.indexOf("DATA CONTROLLER")).toBeLessThan(pre.indexOf(BLANK));
    expect(pre.indexOf(BLANK)).toBeLessThan(pre.indexOf("DATA PROCESSOR"));
    expect(pre.indexOf("DATA PROCESSOR")).toBeLessThan(pre.indexOf("Acme"));

    // TXT: Processor → Acme; Controller label carries the blank placeholder.
    const txt = generateContractTxt(data);
    expect(txt).toMatch(/Processor:\n\s+Acme Processing SL/);
    expect(txt).not.toMatch(/Controller:\n\s+Acme Processing SL/);

    const buf = await renderToBuffer(ContractPDF({ data }) as never);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("CONTROLLER (default/no swap): filling party stays Controller, Processor blank", async () => {
    currentDeal = buildSoloDpa("CONTROLLER");
    const data = (await generateContractData("deal-1"))!;

    expect(data.partyA.company).toBe("Acme Processing SL");
    expect(data.partyB).toBeNull(); // no respondent; Processor slot rendered blank
    expect(data.coverPartyBName).toBe(BLANK);

    const pre = data.boilerplate!.preamble;
    expect(pre.indexOf("DATA CONTROLLER")).toBeLessThan(pre.indexOf("Acme"));
    expect(pre.indexOf("Acme")).toBeLessThan(pre.indexOf("DATA PROCESSOR"));
  });
});
