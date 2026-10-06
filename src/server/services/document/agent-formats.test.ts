// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The agent-native formats (Markdown, HTML) and the agent formation notice.
 * The renderers read the same ContractData as PDF, DOCX and TXT; here they
 * are checked for structure, completeness, filled parties and no long dash
 * of their own, on a hand-built contract and on the real DPA skill.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

let currentDeal: unknown = null;
let currentAgentDeal: unknown = null;
vi.mock("@/lib/prisma", () => ({
  default: {
    dealRoom: { findUnique: vi.fn(async () => currentDeal) },
    agentDealRoom: { findFirst: vi.fn(async () => currentAgentDeal) },
  },
}));

import { agentAttestationFor, generateContractData, UETA_PREAMBLE, type ContractData } from "./generator";
import { generateContractMarkdown } from "./contractMarkdown";
import { generateContractHtml } from "./contractHtml";
import { generateContractTxt } from "./contractTxt";
import { generateContractDocx } from "./contractDocx";

const LONG_DASH = /[\u2013\u2014]/;

/** One entry of a zip (the DOCX), read through the central directory. */
function zipEntry(zip: Buffer, name: string): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = zip.readUInt32LE(eocd + 16);
  const count = zip.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLen = zip.readUInt16LE(at + 28);
    const extraLen = zip.readUInt16LE(at + 30);
    const commentLen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    if (zip.toString("utf8", at + 46, at + 46 + nameLen) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const raw = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not in zip`);
}

function sample(over: Partial<ContractData> = {}): ContractData {
  return {
    dealName: "Acme and Globex NDA",
    contractType: "Non-Disclosure Agreement",
    governingLaw: "State of California, United States of America",
    governingLawKey: "CALIFORNIA",
    createdAt: new Date("2026-10-05T00:00:00Z"),
    language: "en",
    partyA: {
      name: "Ada Founder",
      email: "ada@acme.example",
      company: "Acme Inc",
      legalName: "Acme Inc",
      address: "1 Main St, Los Angeles",
      signatoryName: "Ada Founder",
      signatoryTitle: "CEO",
    },
    partyB: { name: "Globex LLC", email: "", company: "Globex LLC", legalName: "Globex LLC" },
    clauses: [
      { clauseId: "term", title: "Term", category: "General", agreedOption: "2 years", legalText: "This Agreement lasts two years.\n\nIt may be renewed in writing." },
      { clauseId: "permitted-disclosures", title: "Permitted Disclosures", category: "Use", agreedOption: "Advisors", legalText: "The Receiving Party may disclose to:\n(a) its advisors;\n(b) its employees." },
      { clauseId: "remedies", title: "Remedies", category: "Remedies", agreedOption: "Injunction", legalText: "Damages alone may not be enough <and> injunctive relief is available." },
    ],
    governingLawArticle: { title: "Governing Law and Jurisdiction", text: "The courts of Los Angeles County have jurisdiction." },
    boilerplate: {
      contractTitle: "Mutual Non-Disclosure Agreement",
      preamble: "This Agreement is made between Acme Inc and Globex LLC.",
      background: "The parties wish to discuss a possible business relationship.",
      definitions: [{ term: "Confidential Information", definition: "Any non-public information shared under this Agreement." }],
      standardClauses: [{ title: "Return of Information", text: "On request, each party returns the information." }],
      generalProvisions: [{ title: "Entire Agreement", text: "This is the whole agreement." }],
      jurisdictionProvision: null,
      signatureBlock: "",
      partyLabels: { partyA: "Disclosing Party", partyB: "Receiving Party" },
      annexes: [{ title: "Annex I: Purpose", text: "Evaluating a partnership." }],
    },
    ...over,
  } as ContractData;
}

describe("Markdown", () => {
  const md = generateContractMarkdown(sample());

  it("has one title and a heading per section, clauses numbered in order", () => {
    expect(md.match(/^# /gm)).toHaveLength(1);
    expect(md.startsWith("# Mutual Non-Disclosure Agreement\n")).toBe(true);
    for (const h of ["## Parties", "## Background", "## Definitions", "## Negotiated Terms", "## Return of Information", "## General Provisions", "## Governing Law and Jurisdiction", "## Signatures", "## Annex I: Purpose"]) {
      expect(md, h).toContain(`\n${h}\n`);
    }
    const order = ["### 1. Term", "### 2. Permitted Disclosures", "### 3. Remedies"].map((h) => md.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("keeps every clause's text, with line breaks and escaped markup", () => {
    expect(md).toContain("This Agreement lasts two years.\n\nIt may be renewed in writing.");
    expect(md).toContain("The Receiving Party may disclose to:  \n(a) its advisors;  \n(b) its employees.");
    expect(md).toContain("\\<and>");
  });

  it("fills both parties and the signature blocks", () => {
    expect(md).toContain("### Disclosing Party: Acme Inc");
    expect(md).toContain("- **Address:** 1 Main St, Los Angeles");
    expect(md).toContain("- **Contact:** Ada Founder (ada@acme.example)");
    expect(md).toContain("### Receiving Party: Globex LLC");
    expect(md).toContain("- **Contact:** Globex LLC\n");
    expect(md).toContain("- **Title:** CEO");
  });

  it("adds no long dash of its own and no notice on a single-party contract", () => {
    expect(md).not.toMatch(LONG_DASH);
    expect(md).not.toContain("agentic systems");
  });
});

describe("HTML", () => {
  const html = generateContractHtml(sample());

  it("is one self-contained document: no scripts, no external assets", () => {
    expect(html.startsWith("<!doctype html>\n<html lang=\"en\">")).toBe(true);
    expect(html).not.toMatch(/<script|<link|src=|https?:\/\//i);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain("<article>");
  });

  it("gives every clause its own section with a stable id, in order", () => {
    const ids = ["clause-term", "clause-permitted-disclosures", "clause-remedies"];
    const at = ids.map((id) => html.indexOf(`<section id="${id}"`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('<h3 id="clause-term-title">1. Term</h3>');
    expect(html).toContain("(a) its advisors;<br>\n(b) its employees.");
    expect(html).toContain("Damages alone may not be enough &lt;and&gt; injunctive relief is available.");
    expect(html).toContain('<section class="annex" id="annex-annex-i-purpose"');
  });

  it("fills the parties as definition lists and defines terms with dfn", () => {
    expect(html).toContain('<h3 id="party-a-title">Disclosing Party: Acme Inc</h3>');
    expect(html).toContain("<dt>Address</dt><dd>1 Main St, Los Angeles</dd>");
    expect(html).toContain('<h3 id="party-b-title">Receiving Party: Globex LLC</h3>');
    expect(html).toContain("<dt><dfn>Confidential Information</dfn></dt>");
  });

  it("adds no long dash of its own", () => {
    expect(html).not.toMatch(LONG_DASH);
  });
});

describe("agent formation notice", () => {
  const twoAgents = {
    initiatorPlaybookId: "pb_1",
    respondentPlaybookId: "pb_2",
    attestingBarNumber: null,
    attestingAttorneyName: null,
  };

  it("applies only when both sides negotiated through agents", () => {
    expect(agentAttestationFor(null)).toBeUndefined();
    // Single-party contract made by one agent (solo intake, the one call).
    expect(agentAttestationFor({ ...twoAgents, initiatorPlaybookId: null, respondentPlaybookId: null })).toBeUndefined();
    // Initiated, never joined.
    expect(agentAttestationFor({ ...twoAgents, respondentPlaybookId: null })).toBeUndefined();
    expect(agentAttestationFor(twoAgents)?.uetaPreamble).toBe(UETA_PREAMBLE.en);
    expect(
      agentAttestationFor({ ...twoAgents, attestingBarNumber: "CA-1", attestingAttorneyName: "J. Doe" })?.attestationFooter,
    ).toContain("J. Doe (Bar No. CA-1)");
  });

  it("uses the owner's wording, in the contract's language", () => {
    expect(UETA_PREAMBLE.en).toBe(
      "This agreement was formed by two agentic systems negotiating with each other, pursuant to the Uniform Electronic Transactions Act § 14 and the Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.). Each party authorized its electronic agent to negotiate and accept the terms herein.",
    );
    expect(UETA_PREAMBLE.es).toContain("formado por dos sistemas agénticos que negociaron entre sí");
    expect(agentAttestationFor(twoAgents, "es")?.uetaPreamble).toBe(UETA_PREAMBLE.es);
    for (const text of Object.values(UETA_PREAMBLE)) {
      expect(text).not.toContain("interaction of electronic agents");
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("is printed in every text format of a two-agent contract, and in none of a single-party one", async () => {
    const withNotice = sample({ agentAttestation: agentAttestationFor(twoAgents) });
    for (const out of [generateContractMarkdown(withNotice), generateContractHtml(withNotice), generateContractTxt(withNotice)]) {
      expect(out).toContain("formed by two agentic systems negotiating with each other");
    }
    const without = sample();
    for (const out of [generateContractMarkdown(without), generateContractHtml(without), generateContractTxt(without)]) {
      expect(out).not.toContain("agentic systems");
    }
    const docx = async (d: ContractData) => zipEntry(await generateContractDocx(d), "word/document.xml");
    expect(await docx(withNotice)).toContain("formed by two agentic systems negotiating with each other");
    expect(await docx(without)).not.toContain("agentic systems");
  });
});

// The real DPA skill through the real generator: every standard clause and
// annex title reaches both formats, and the renderers add no long dash.
describe("real DPA skill", () => {
  const boilerplate = JSON.parse(readFileSync(resolve(process.cwd(), "skills/dpa/boilerplate.json"), "utf8"));
  const parameters = JSON.parse(readFileSync(resolve(process.cwd(), "skills/dpa/parameters.json"), "utf8"));
  const party = (role: string, name: string) => ({
    role,
    name,
    email: `${name.split(" ")[0].toLowerCase()}@example.test`,
    company: name,
    signingDetails: { legalName: name, address: "1 Calle Mayor, Madrid", signatoryName: "Signer", signatoryTitle: "CEO" },
  });

  beforeEach(() => {
    currentAgentDeal = null;
    currentDeal = {
      id: "deal-1",
      name: "DPA",
      dealMode: "NEGOTIATION",
      contractLanguage: "en",
      governingLaw: "SPAIN",
      createdAt: new Date("2026-10-05T00:00:00Z"),
      parameters: {},
      soloFillRole: "CONTROLLER",
      contractTemplate: { displayName: "Data Processing Agreement", contractType: "DPA", boilerplate, parameterSchema: parameters },
      parties: [party("INITIATOR", "Acme Controller SL"), party("RESPONDENT", "Globex Processor GmbH")],
      signingRequest: null,
      clauses: [],
    };
  });

  it("lists every section and annex, with both parties, in Markdown and HTML", async () => {
    const data = (await generateContractData("deal-1"))!;
    const md = generateContractMarkdown(data);
    const html = generateContractHtml(data);
    const titles = [
      ...(data.boilerplate?.standardClauses ?? []).map((c) => c.title),
      ...(data.boilerplate?.annexes ?? []).map((a) => a.title),
    ];
    expect(titles.length).toBeGreaterThan(3);
    for (const t of titles) {
      expect(md, t).toContain(t);
      expect(html, t).toContain(t.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;"));
    }
    for (const out of [md, html]) {
      expect(out).toContain("Acme Controller SL");
      expect(out).toContain("Globex Processor GmbH");
      expect(out).not.toContain("agentic systems");
    }
    // No long dash beyond those in the skill's own text.
    const source = JSON.stringify(data);
    const count = (s: string) => (s.match(/[\u2013\u2014]/g) ?? []).length;
    expect(count(md)).toBeLessThanOrEqual(count(source));
    expect(count(html)).toBeLessThanOrEqual(count(source));
  });

  it("prints the notice on a deal negotiated between two agents", async () => {
    currentAgentDeal = {
      initiatorPlaybookId: "pb_1",
      respondentPlaybookId: "pb_2",
      attestingBarNumber: null,
      attestingAttorneyName: null,
    };
    const data = (await generateContractData("deal-1"))!;
    expect(generateContractMarkdown(data)).toContain("> This agreement was formed by two agentic systems negotiating with each other");
  });

  it("leaves it out of a single-party contract made by one agent", async () => {
    currentAgentDeal = {
      initiatorPlaybookId: null,
      respondentPlaybookId: null,
      attestingBarNumber: null,
      attestingAttorneyName: null,
    };
    const data = (await generateContractData("deal-1"))!;
    expect(data.agentAttestation).toBeUndefined();
    expect(generateContractTxt(data)).not.toContain("agentic systems");
  });
});
