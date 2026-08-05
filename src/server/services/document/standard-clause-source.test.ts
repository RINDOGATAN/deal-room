// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ContractData } from "./generator";
import { generateContractTxt } from "./contractTxt";
import { generateContractDocx } from "./contractDocx";
import { ContractPDF } from "./ContractPDF";

/**
 * Standard clauses may carry a `source` — the statutory citation behind the
 * clause ("LAU 29/1994 art. 9"). Skills whose standard clauses reproduce
 * mandatory law (the residential tenancy family) rely on it being printed, so
 * the reader can see the app is restating the statute rather than inventing
 * terms. Skills without the field must render exactly as they did before.
 */
const base: Omit<ContractData, "boilerplate"> = {
  dealName: "Landlord ↔ Tenant tenancy",
  contractType: "Contrato de Arrendamiento de Vivienda",
  governingLaw: "Kingdom of Spain",
  governingLawKey: "SPAIN",
  createdAt: new Date("2026-08-05T00:00:00Z"),
  partyA: { name: "L. Arrendador", email: "landlord@example.test", company: "L. Arrendador" },
  partyB: { name: "T. Arrendatario", email: "tenant@example.test", company: "T. Arrendatario" },
  clauses: [
    { title: "Duración del contrato", category: "Duración", agreedOption: "5 años", legalText: "El plazo será de cinco años." },
  ],
  language: "es",
};

const boilerplate = (withSource: boolean): ContractData["boilerplate"] => ({
  contractTitle: "CONTRATO DE ARRENDAMIENTO DE VIVIENDA",
  preamble: "Reunidos el Arrendador y el Arrendatario.",
  definitions: [],
  standardClauses: [
    {
      title: "Ley aplicable",
      text: "El presente contrato se rige por la LAU.",
      ...(withSource ? { source: "Art. 4 y 6 LAU 29/1994" } : {}),
    },
    {
      title: "Fianza",
      text: "La fianza será de una mensualidad.",
      ...(withSource ? { source: "Art. 36 LAU 29/1994" } : {}),
    },
  ],
  generalProvisions: [{ title: "Notificaciones", text: "Se harán por escrito." }],
  jurisdictionProvision: null,
  signatureBlock: "FIRMADO por las partes.",
  partyLabels: { partyA: "Arrendador", partyB: "Arrendatario" },
});

const withSource: ContractData = { ...base, boilerplate: boilerplate(true) };
const withoutSource: ContractData = { ...base, boilerplate: boilerplate(false) };

describe("standard-clause statutory source", () => {
  it("TXT: prints the citation after the clause body", () => {
    const txt = generateContractTxt(withSource);
    expect(txt).toContain("Art. 4 y 6 LAU 29/1994");
    expect(txt).toContain("Art. 36 LAU 29/1994");
    // It belongs to the clause, so it must follow that clause's text.
    expect(txt.indexOf("Art. 4 y 6 LAU 29/1994")).toBeGreaterThan(
      txt.indexOf("El presente contrato se rige por la LAU."),
    );
    // ...and precede the NEXT standard clause, not drift to the end.
    expect(txt.indexOf("Art. 4 y 6 LAU 29/1994")).toBeLessThan(
      txt.indexOf("La fianza será de una mensualidad."),
    );
  });

  it("TXT: omits the citation line entirely when no source is authored", () => {
    const txt = generateContractTxt(withoutSource);
    expect(txt).not.toContain("LAU 29/1994");
    expect(txt).toContain("El presente contrato se rige por la LAU.");
  });

  it("DOCX: renders with and without a source", async () => {
    const a = await generateContractDocx(withSource);
    const b = await generateContractDocx(withoutSource);
    expect(a.length).toBeGreaterThan(1000);
    expect(b.length).toBeGreaterThan(1000);
    // The citation is real content, so the sourced document must be larger.
    expect(a.length).toBeGreaterThan(b.length);
  });

  it("PDF: renders with and without a source", async () => {
    const a = await renderToBuffer(ContractPDF({ data: withSource }));
    const b = await renderToBuffer(ContractPDF({ data: withoutSource }));
    expect(a.length).toBeGreaterThan(1000);
    expect(b.length).toBeGreaterThan(1000);
  });
});
