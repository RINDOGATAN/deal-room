// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One-call generation: the catalogue checks, the up-front credit check, the
 * hand-off to the solo intake and the payment through dealAccessForAgent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ stripeEnabled: true, agentApi: true }));
vi.mock("@/config/features", () => ({ features: flags }));
vi.mock("@/config/brand", () => ({ brand: { appDomain: "dealroom.test" } }));
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const intake = vi.hoisted(() => ({ createSoloDealFromFacts: vi.fn() }));
vi.mock("@/server/services/agent/soloIntake", () => intake);

const entitlement = vi.hoisted(() => ({ dealAccessForAgent: vi.fn() }));
vi.mock("@/server/services/billing/deal-entitlement", () => entitlement);

vi.mock("@/server/services/document/generator", () => ({
  generateContractData: vi.fn(async () => ({ dealName: "x" })),
}));
vi.mock("@/server/services/document/contractTxt", () => ({
  generateContractTxt: vi.fn(() => "MUTUAL NON-DISCLOSURE AGREEMENT ..."),
}));
vi.mock("@/server/services/document/contractMarkdown", () => ({
  generateContractMarkdown: vi.fn(() => "# Mutual Non-Disclosure Agreement\n"),
}));
vi.mock("@/server/services/document/contractHtml", () => ({
  generateContractHtml: vi.fn(() => "<!doctype html><title>NDA</title>"),
}));

import { generateContract, generateContractSchema } from "@/server/services/agent/generateContract";

const CATALOGUE = [
  {
    contractType: "NDA",
    displayName: "Non-Disclosure Agreement",
    jurisdictions: ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"],
    languages: ["en", "es"],
    parameterSchema: {
      version: "1.0",
      parameters: [
        { id: "dispute-forum-city", token: "t", scope: "x", type: "text", required: true, default: "Madrid", jurisdictions: ["SPAIN"], label: "City" },
        { id: "custom-courts", token: "t", scope: "x", type: "text", required: false, label: "Courts" },
      ],
    },
  },
  { contractType: "DELAWARE_CERT_OF_INCORPORATION", displayName: "Certificate of Incorporation", jurisdictions: ["DELAWARE"], languages: ["en"] },
  { contractType: "A2A_SERVICE_LEVEL", displayName: "A2A SLA", jurisdictions: ["CALIFORNIA"], languages: ["en"] },
];

function db(opts: { balance?: number | null; owner?: { id: string } | null } = {}) {
  return {
    contractTemplate: { findMany: vi.fn(async () => CATALOGUE) },
    customerCredit: {
      findUnique: vi.fn(async () => (opts.balance === null || opts.balance === undefined ? null : { balance: opts.balance })),
    },
    user: { findFirst: vi.fn(async () => (opts.owner === undefined ? { id: "user_1" } : opts.owner)) },
  };
}

const AUTH = {
  customer: { id: "cust_1", name: "Acme Inc", email: "founder@acme.example" },
  apiKey: { id: "key_1" },
};

function input(extra: Record<string, unknown> = {}) {
  return generateContractSchema.parse({
    contractType: "NDA",
    governingLaw: "CALIFORNIA",
    party: { legalName: "Acme Inc", signatoryName: "Ada Founder", signatoryTitle: "CEO" },
    counterparty: { legalName: "Globex LLC" },
    ...extra,
  });
}

beforeEach(() => {
  flags.stripeEnabled = true;
  intake.createSoloDealFromFacts.mockResolvedValue({
    ok: true,
    agentDealRoomId: "adr_1",
    dealRoomId: "deal_1",
    status: "AGREED",
    unresolvedClauseIds: [],
  });
  entitlement.dealAccessForAgent.mockResolvedValue({ paid: true, via: "credit" });
});

afterEach(() => vi.clearAllMocks());

describe("generateContract", () => {
  it("makes the contract, spends one credit and returns the links", async () => {
    const prisma = db({ balance: 3 });
    const res = await generateContract(prisma as never, AUTH, input());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      dealId: "adr_1",
      dealRoomId: "deal_1",
      status: "AGREED",
      contractType: "NDA",
      governingLaw: "CALIFORNIA",
      language: "en",
      paid: "credit",
      dealUrl: "https://dealroom.test/deals/deal_1",
      documents: {
        pdf: "https://dealroom.test/api/v1/agent/deals/adr_1/document",
        docx: "https://dealroom.test/api/v1/agent/deals/adr_1/document/docx",
        txt: "https://dealroom.test/api/v1/agent/deals/adr_1/document/txt",
        md: "https://dealroom.test/api/v1/agent/deals/adr_1/document/md",
        html: "https://dealroom.test/api/v1/agent/deals/adr_1/document/html",
      },
      guide: "https://dealroom.test/contracts/nda",
    });
    expect(res.body).not.toHaveProperty("document");

    expect(intake.createSoloDealFromFacts).toHaveBeenCalledWith(
      prisma,
      AUTH.customer,
      expect.objectContaining({
        contractType: "NDA",
        governingLaw: "CALIFORNIA",
        selectionPolicy: "defaults",
        dealName: "Non-Disclosure Agreement (Acme Inc and Globex LLC)",
        initiatorCompany: "Acme Inc",
        initiatorDetails: expect.objectContaining({ legalName: "Acme Inc", signatoryTitle: "CEO" }),
        counterparty: { legalName: "Globex LLC" },
        initiatorUserId: "user_1",
      }),
    );
    // Paid exactly as the first document download is.
    expect(entitlement.dealAccessForAgent).toHaveBeenCalledWith("deal_1", { apiKeyId: "key_1", customerId: "cust_1" });
  });

  it("answers 402 and creates nothing when the customer holds no credit", async () => {
    for (const balance of [0, null]) {
      const res = await generateContract(db({ balance }) as never, AUTH, input());
      expect(res.status).toBe(402);
      expect(res.body).toMatchObject({ code: "PAYMENT_REQUIRED", checkout: { url: "/api/v1/agent/credits/checkout" } });
    }
    expect(intake.createSoloDealFromFacts).not.toHaveBeenCalled();
    expect(entitlement.dealAccessForAgent).not.toHaveBeenCalled();
  });

  it("answers 402 with the deal id when the last credit went elsewhere meanwhile", async () => {
    entitlement.dealAccessForAgent.mockResolvedValue({ paid: false });
    const res = await generateContract(db({ balance: 1 }) as never, AUTH, input());
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ code: "PAYMENT_REQUIRED", dealId: "adr_1" });
    expect(res.body).not.toHaveProperty("documents");
  });

  it("skips the credit check where payments are off", async () => {
    flags.stripeEnabled = false;
    entitlement.dealAccessForAgent.mockResolvedValue({ paid: true, via: "billing_off" });
    const prisma = db({ balance: null });
    const res = await generateContract(prisma as never, AUTH, input());
    expect(res.status).toBe(201);
    expect(res.body.paid).toBe("billing_off");
    expect(prisma.customerCredit.findUnique).not.toHaveBeenCalled();
  });

  it("accepts the guide slug or a lower-case code", async () => {
    for (const contractType of ["nda", "Nda"]) {
      const res = await generateContract(db({ balance: 1 }) as never, AUTH, input({ contractType }));
      expect(res.status).toBe(201);
      expect(res.body.contractType).toBe("NDA");
    }
  });

  it("answers 404 for an unknown contract type, pointing to the list", async () => {
    const res = await generateContract(db({ balance: 1 }) as never, AUTH, input({ contractType: "LEASE_ON_MARS" }));
    expect(res.status).toBe(404);
    expect(String(res.body.hint)).toContain("/api/v1/agent/contract-types");
    expect(intake.createSoloDealFromFacts).not.toHaveBeenCalled();
  });

  it("refuses agent-to-agent protocol templates (they keep their weekly limits)", async () => {
    const res = await generateContract(db({ balance: 1 }) as never, AUTH, input({ contractType: "A2A_SERVICE_LEVEL" }));
    expect(res.status).toBe(422);
    expect(intake.createSoloDealFromFacts).not.toHaveBeenCalled();
  });

  it("checks the governing law against the contract type", async () => {
    const wrong = await generateContract(db({ balance: 1 }) as never, AUTH, input({ governingLaw: "NEW_YORK" }));
    expect(wrong.status).toBe(422);
    expect(wrong.body.allowed).toEqual(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]);

    const missing = await generateContract(db({ balance: 1 }) as never, AUTH, input({ governingLaw: undefined }));
    expect(missing.status).toBe(422);
    expect(String(missing.body.error)).toContain("governingLaw is required");
    expect(intake.createSoloDealFromFacts).not.toHaveBeenCalled();
  });

  it("uses the only governing law a type offers when none is sent (Delaware runs under California)", async () => {
    const res = await generateContract(
      db({ balance: 1 }) as never,
      AUTH,
      input({ contractType: "delaware-certificate-of-incorporation", governingLaw: undefined }),
    );
    expect(res.status).toBe(201);
    expect(intake.createSoloDealFromFacts).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ contractType: "DELAWARE_CERT_OF_INCORPORATION", governingLaw: "CALIFORNIA" }),
    );
  });

  it("passes the intake's own refusal through (missing required inputs), with nothing charged", async () => {
    intake.createSoloDealFromFacts.mockResolvedValue({
      ok: false,
      status: 422,
      error: "Missing required parameters",
      details: { missing: ["dispute-forum-city"] },
    });
    const res = await generateContract(db({ balance: 1 }) as never, AUTH, input());
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Missing required parameters", details: { missing: ["dispute-forum-city"] } });
    expect(entitlement.dealAccessForAgent).not.toHaveBeenCalled();
  });

  it("charges nothing when a clause could not be settled", async () => {
    intake.createSoloDealFromFacts.mockResolvedValue({
      ok: true,
      agentDealRoomId: "adr_2",
      dealRoomId: "deal_2",
      status: "NEGOTIATING",
      unresolvedClauseIds: ["non-solicitation"],
    });
    const res = await generateContract(db({ balance: 1 }) as never, AUTH, input());
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ dealId: "adr_2", unresolvedClauseIds: ["non-solicitation"] });
    expect(entitlement.dealAccessForAgent).not.toHaveBeenCalled();
  });

  it("fills inputs left out with their default, only under the law they belong to", async () => {
    await generateContract(db({ balance: 1 }) as never, AUTH, input({ governingLaw: "SPAIN" }));
    expect(intake.createSoloDealFromFacts).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ parameters: { "dispute-forum-city": "Madrid" } }),
    );
    await generateContract(db({ balance: 1 }) as never, AUTH, input({ governingLaw: "SPAIN", terms: { "dispute-forum-city": "Bilbao" } }));
    expect(intake.createSoloDealFromFacts).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ parameters: { "dispute-forum-city": "Bilbao" } }),
    );
    await generateContract(db({ balance: 1 }) as never, AUTH, input());
    expect(intake.createSoloDealFromFacts).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ parameters: {} }),
    );
  });

  it("returns the contract inline in the asked format", async () => {
    const md = await generateContract(db({ balance: 1 }) as never, AUTH, input({ inline: "md" }));
    expect(md.body.document).toEqual({ format: "md", content: "# Mutual Non-Disclosure Agreement\n" });
    const html = await generateContract(db({ balance: 1 }) as never, AUTH, input({ inline: "html" }));
    expect((html.body.document as { content: string }).content).toContain("<!doctype html>");
    const txt = await generateContract(db({ balance: 1 }) as never, AUTH, input({ inline: "txt" }));
    expect((txt.body.document as { content: string }).content).toContain("NON-DISCLOSURE");
    expect(generateContractSchema.safeParse({ contractType: "NDA", party: { legalName: "A" }, inline: "pdf" }).success).toBe(false);
  });

  it("gives no browser link when no account uses the customer's e-mail", async () => {
    const res = await generateContract(db({ balance: 1, owner: null }) as never, AUTH, input());
    expect(res.status).toBe(201);
    expect(res.body.dealUrl).toBeNull();
    expect(res.body.dealUrlNote).toBeTruthy();
    expect(intake.createSoloDealFromFacts).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ initiatorUserId: undefined }),
    );
  });
});

describe("generateContractSchema", () => {
  it("needs a contract type and your side's legal name", () => {
    expect(generateContractSchema.safeParse({ party: { legalName: "Acme" } }).success).toBe(false);
    expect(generateContractSchema.safeParse({ contractType: "NDA" }).success).toBe(false);
    expect(generateContractSchema.safeParse({ contractType: "NDA", party: {} }).success).toBe(false);
    expect(generateContractSchema.safeParse({ contractType: "NDA", party: { legalName: "Acme" } }).success).toBe(true);
  });

  it("rejects a malformed e-mail and non-text inputs", () => {
    expect(
      generateContractSchema.safeParse({ contractType: "NDA", party: { legalName: "A", email: "not-an-email" } }).success,
    ).toBe(false);
    expect(
      generateContractSchema.safeParse({ contractType: "NDA", party: { legalName: "A" }, terms: { term: 3 } }).success,
    ).toBe(false);
  });
});
