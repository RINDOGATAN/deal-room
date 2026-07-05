import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ContractData } from "./generator";
import { generateContractTxt } from "./contractTxt";
import { generateContractDocx } from "./contractDocx";
import { ContractPDF } from "./ContractPDF";

const data: ContractData = {
  dealName: "Acme ↔ Globex DPA",
  contractType: "Data Processing Agreement",
  governingLaw: "Kingdom of Spain",
  governingLawKey: "SPAIN",
  createdAt: new Date("2026-06-04T00:00:00Z"),
  partyA: { name: "Acme Corp", email: "legal@acme.example", company: "Acme Corp", legalName: "Acme Corp S.L.", signatoryName: "A. Director", signatoryTitle: "CEO" },
  partyB: null, // solo
  clauses: [
    { title: "Scope of processing", category: "Processing", agreedOption: "Standard", legalText: "The Processor shall process Personal Data only as needed to provide the services." },
    { title: "Liability & indemnification", category: "Liability", agreedOption: "Capped at 2x annual fees", legalText: "The Processor's aggregate liability is capped at two times annual fees." },
  ],
  boilerplate: {
    contractTitle: "DATA PROCESSING AGREEMENT",
    preamble: "This DPA is entered into between Acme Corp S.L. (Controller) and [_________________] (Processor).",
    background: "Engaged under EU GDPR and the UK GDPR and the Data Protection Act 2018, in each case as amended by the Data (Use and Access) Act 2025.",
    definitions: [{ term: "Personal Data", definition: "information relating to an identified or identifiable natural person." }],
    standardClauses: [
      { title: "Assistance with compliance", text: "The Processor shall assist with DPIAs (Art 35) and prior consultation (Art 36)." },
      { title: "Controller obligations", text: "The Controller warrants it has a lawful basis." },
    ],
    generalProvisions: [{ title: "Order of precedence", text: "This DPA prevails on data protection matters." }],
    jurisdictionProvision: { title: "Spain-specific provisions", text: "Governed by the EU GDPR and the LOPDGDD." },
    signatureBlock: "SIGNED by the parties:\n\nFor and on behalf of Acme Corp S.L.:\nName: A. Director\n\nFor and on behalf of [_________________]:\nName: [_________________]",
    partyLabels: { partyA: "Controller", partyB: "Processor" },
    annexes: [
      { title: "Annex I — Description of Processing", text: "1. SUBJECT MATTER\nProcessing of customer data.\n\n2. TYPES OF PERSONAL DATA\n(a) Identifiers;\n(b) Contact information." },
      { title: "Annex II — Technical and Organisational Measures", text: "1. ENCRYPTION\n(a) TLS 1.2+ in transit;\n(b) AES-256 at rest.\n\n2. ACCESS CONTROL\n(a) RBAC; (b) MFA." },
    ],
  },
  language: "en",
};

describe("annex rendering", () => {
  it("TXT: annexes appear AFTER signatures", () => {
    const txt = generateContractTxt(data);
    const sigIdx = txt.indexOf("SIGNATURES");
    const annexIIdx = txt.indexOf("ANNEX I");
    const annexIIIdx = txt.indexOf("ANNEX II");
    expect(sigIdx).toBeGreaterThan(-1);
    expect(annexIIdx).toBeGreaterThan(sigIdx);
    expect(annexIIIdx).toBeGreaterThan(annexIIdx);
    expect(txt).toContain("AES-256 at rest");
    expect(txt).toContain("as amended by the Data (Use and Access) Act 2025");
  });

  it("DOCX: renders to a non-empty buffer", async () => {
    const buf = await generateContractDocx(data);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("PDF: renders to a non-empty buffer", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-pdf's renderToBuffer wants ReactElement<DocumentProps>; ContractPDF returns generic JSX
    const buf = await renderToBuffer(ContractPDF({ data }) as any);
    expect(buf.length).toBeGreaterThan(1000);
  });
});
