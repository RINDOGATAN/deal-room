// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract TXT Generator Service
 *
 * Generates a plain text document from contract data
 * using unicode box-drawing characters for structure.
 */

import type { ContractData } from "./generator";

const LABELS: Record<string, Record<string, string>> = {
  en: {
    effectiveDate: "Effective Date",
    background: "Background",
    definitions: "Definitions",
    negotiatedTerms: "Negotiated Terms",
    generalProvisions: "General Provisions",
    governingLaw: "Governing Law",
    signatures: "Signatures",
    inWitnessWhereof:
      "IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.",
    date: "Date:",
    partyA: "Party A",
    partyB: "Party B",
    parties: "Parties",
  },
  es: {
    effectiveDate: "Fecha de Efecto",
    background: "Antecedentes",
    definitions: "Definiciones",
    negotiatedTerms: "Términos Negociados",
    generalProvisions: "Disposiciones Generales",
    governingLaw: "Ley Aplicable",
    signatures: "Firmas",
    inWitnessWhereof:
      "EN FE DE LO CUAL, las partes han suscrito el presente Acuerdo en la Fecha de Efecto.",
    date: "Fecha:",
    partyA: "Parte A",
    partyB: "Parte B",
    parties: "Partes",
  },
};

function formatDate(date: Date, language: string = "en"): string {
  const locale = language === "es" ? "es-ES" : "en-US";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function divider(char: string = "─", width: number = 60): string {
  return char.repeat(width);
}

function sectionHeader(title: string): string {
  return `\n${title.toUpperCase()}\n${divider("─", title.length)}`;
}

export function generateContractTxt(data: ContractData): string {
  const lang = data.language || "en";
  const l = LABELS[lang] || LABELS.en;
  const partyALabel = data.boilerplate?.partyLabels?.partyA || l.partyA;
  const partyBLabel = data.boilerplate?.partyLabels?.partyB || l.partyB;
  const lines: string[] = [];

  // Title block
  const title = data.boilerplate?.contractTitle || data.dealName;
  lines.push(divider("═", 60));
  lines.push(`  ${title.toUpperCase()}`);
  lines.push(divider("═", 60));
  lines.push("");
  lines.push(`${l.effectiveDate}: ${formatDate(data.createdAt, lang)}`);
  lines.push(`${l.governingLaw}: ${data.governingLaw}`);
  lines.push("");

  // Preamble
  if (data.boilerplate?.preamble) {
    lines.push(data.boilerplate.preamble);
    lines.push("");
  }

  // Parties
  lines.push(sectionHeader(l.parties));
  lines.push("");
  lines.push(`${partyALabel}:`);
  lines.push(`  ${data.partyA.company || data.partyA.name}`);
  if (data.partyA.legalName) lines.push(`  Legal Name: ${data.partyA.legalName}`);
  if (data.partyA.address) lines.push(`  Address: ${data.partyA.address}`);
  if (data.partyA.taxId) lines.push(`  Tax ID: ${data.partyA.taxId}`);
  lines.push(`  Contact: ${data.partyA.name} (${data.partyA.email})`);
  lines.push("");

  if (data.partyB) {
    lines.push(`${partyBLabel}:`);
    lines.push(`  ${data.partyB.company || data.partyB.name}`);
    if (data.partyB.legalName) lines.push(`  Legal Name: ${data.partyB.legalName}`);
    if (data.partyB.address) lines.push(`  Address: ${data.partyB.address}`);
    if (data.partyB.taxId) lines.push(`  Tax ID: ${data.partyB.taxId}`);
    lines.push(`  Contact: ${data.partyB.name} (${data.partyB.email})`);
    lines.push("");
  }

  // Background
  if (data.boilerplate?.background) {
    lines.push(sectionHeader(l.background));
    lines.push("");
    lines.push(data.boilerplate.background);
    lines.push("");
  }

  // Definitions
  if (data.boilerplate?.definitions && data.boilerplate.definitions.length > 0) {
    lines.push(sectionHeader(l.definitions));
    lines.push("");
    for (const def of data.boilerplate.definitions) {
      lines.push(`"${def.term}" — ${def.definition}`);
      lines.push("");
    }
  }

  // Negotiated Terms (Clauses)
  if (data.clauses.length > 0) {
    lines.push(sectionHeader(l.negotiatedTerms));
    lines.push("");
    for (let i = 0; i < data.clauses.length; i++) {
      const clause = data.clauses[i];
      lines.push(`${i + 1}. ${clause.title}`);
      lines.push(`   [${clause.agreedOption}]`);
      lines.push("");
      // Indent legal text
      const textLines = clause.legalText.split("\n");
      for (const tl of textLines) {
        lines.push(`   ${tl}`);
      }
      lines.push("");
    }
  }

  // Standard Clauses (from boilerplate)
  if (data.boilerplate?.standardClauses && data.boilerplate.standardClauses.length > 0) {
    for (const sc of data.boilerplate.standardClauses) {
      lines.push(sectionHeader(sc.title));
      lines.push("");
      lines.push(sc.text);
      lines.push("");
    }
  }

  // General Provisions
  if (data.boilerplate?.generalProvisions && data.boilerplate.generalProvisions.length > 0) {
    lines.push(sectionHeader(l.generalProvisions));
    lines.push("");
    for (const gp of data.boilerplate.generalProvisions) {
      lines.push(`${gp.title}`);
      lines.push(gp.text);
      lines.push("");
    }
  }

  // Governing law and jurisdiction — its own article (negotiated forum)
  if (data.governingLawArticle) {
    lines.push(sectionHeader(data.governingLawArticle.title));
    lines.push("");
    lines.push(data.governingLawArticle.text);
    lines.push("");
  }

  // Jurisdiction-specific regulatory provision(s) — multi or single
  const jpList = data.boilerplate?.jurisdictionProvisions?.length
    ? data.boilerplate.jurisdictionProvisions
    : data.boilerplate?.jurisdictionProvision
      ? [data.boilerplate.jurisdictionProvision]
      : [];
  for (const jp of jpList) {
    lines.push(sectionHeader(jp.title));
    lines.push("");
    lines.push(jp.text);
    lines.push("");
  }

  // Signatures
  lines.push(sectionHeader(l.signatures));
  lines.push("");
  if (data.boilerplate?.signatureBlock) {
    lines.push(data.boilerplate.signatureBlock);
    lines.push("");
  } else {
    lines.push(l.inWitnessWhereof);
    lines.push("");
  }

  lines.push(`${partyALabel}:`);
  lines.push(`Name: ${data.partyA.signatoryName || data.partyA.name}`);
  if (data.partyA.signatoryTitle) lines.push(`Title: ${data.partyA.signatoryTitle}`);
  lines.push(`${l.date} ____________________`);
  lines.push("");

  if (data.partyB) {
    lines.push(`${partyBLabel}:`);
    lines.push(`Name: ${data.partyB.signatoryName || data.partyB.name}`);
    if (data.partyB.signatoryTitle) lines.push(`Title: ${data.partyB.signatoryTitle}`);
    lines.push(`${l.date} ____________________`);
    lines.push("");
  }

  // Annexes — after the signature blocks, each separated by a page-feed marker.
  if (data.boilerplate?.annexes && data.boilerplate.annexes.length > 0) {
    for (const annex of data.boilerplate.annexes) {
      lines.push("\f"); // form feed: a page break for text renderers
      lines.push(divider("═", 60));
      lines.push(`  ${annex.title.toUpperCase()}`);
      lines.push(divider("═", 60));
      lines.push("");
      lines.push(annex.text);
      lines.push("");
    }
  }

  lines.push(divider("═", 60));

  return lines.join("\n");
}
