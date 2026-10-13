// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract TXT Generator Service
 *
 * Generates a plain text document from contract data
 * using unicode box-drawing characters for structure.
 */

import { buildSequentialSections, type ContractData } from "./generator";
import { agentNoticeParagraphs } from "./agentNotice";

/** Section labels by language, shared with the Markdown and HTML renderers. */
export const LABELS: Record<string, Record<string, string>> = {
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

export function formatDate(date: Date, language: string = "en"): string {
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

/** Party and signature field labels, in the contract's language. */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  en: { legalName: "Legal Name", address: "Address", jurisdiction: "Jurisdiction of incorporation", taxId: "Tax ID", contact: "Contact", name: "Name", title: "Title" },
  es: { legalName: "Nombre o denominación", address: "Domicilio", jurisdiction: "Lugar de constitución", taxId: "Identificación fiscal", contact: "Contacto", name: "Nombre", title: "Cargo" },
};

export function generateContractTxt(data: ContractData): string {
  const lang = data.language || "en";
  const l = LABELS[lang] || LABELS.en;
  const fl = FIELD_LABELS[lang] || FIELD_LABELS.en;
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

  // Agent formation notice (two-agent negotiations only)
  for (const p of agentNoticeParagraphs(data)) {
    lines.push(p);
    lines.push("");
  }

  // Preamble
  if (data.boilerplate?.preamble) {
    lines.push(data.boilerplate.preamble);
    lines.push("");
  }

  // Parties
  lines.push(sectionHeader(l.parties));
  lines.push("");
  lines.push(`${partyALabel}:`);
  lines.push(`  ${data.partyA.legalName || data.partyA.company || data.partyA.name}`);
  if (data.partyA.legalName) lines.push(`  ${fl.legalName}: ${data.partyA.legalName}`);
  if (data.partyA.address) lines.push(`  ${fl.address}: ${data.partyA.address}`);
  if (data.partyA.jurisdiction) lines.push(`  ${fl.jurisdiction}: ${data.partyA.jurisdiction}`);
  if (data.partyA.taxId) lines.push(`  ${fl.taxId}: ${data.partyA.taxId}`);
  if (data.partyA.contact) lines.push(`  ${fl.contact}: ${data.partyA.contact}`);
  lines.push("");

  if (data.partyB) {
    lines.push(`${partyBLabel}:`);
    lines.push(`  ${data.partyB.legalName || data.partyB.company || data.partyB.name}`);
    if (data.partyB.legalName) lines.push(`  ${fl.legalName}: ${data.partyB.legalName}`);
    if (data.partyB.address) lines.push(`  ${fl.address}: ${data.partyB.address}`);
    if (data.partyB.jurisdiction) lines.push(`  ${fl.jurisdiction}: ${data.partyB.jurisdiction}`);
    if (data.partyB.taxId) lines.push(`  ${fl.taxId}: ${data.partyB.taxId}`);
    if (data.partyB.contact) lines.push(`  ${fl.contact}: ${data.partyB.contact}`);
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

  // Sequential-numbering layout (BAA): one continuous agreement — negotiable
  // clauses and fixed standardClauses merged into a single list ordered by
  // their true section number, each heading "N. Title".
  const sequential = data.boilerplate?.sequentialNumbering === true;

  if (sequential) {
    for (const s of buildSequentialSections(data)) {
      lines.push(sectionHeader(`${s.sectionNumber}. ${s.title}`));
      lines.push("");
      lines.push(s.body);
      lines.push("");
    }
  } else {
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
        if (sc.source) {
          lines.push("");
          lines.push(`   [${sc.source}]`);
        }
        lines.push("");
      }
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

  // A signature block whose text already holds each party's block (most
  // templates) needs no second, structured one.
  if (!data.boilerplate?.signatureBlockHasParties) {
    lines.push(`${partyALabel}:`);
    lines.push(`${fl.name}: ${data.partyA.signatoryName || "____________________"}`);
    if (data.partyA.signatoryTitle) lines.push(`${fl.title}: ${data.partyA.signatoryTitle}`);
    lines.push(`${l.date} ____________________`);
    lines.push("");

    if (data.partyB) {
      lines.push(`${partyBLabel}:`);
      lines.push(`${fl.name}: ${data.partyB.signatoryName || "____________________"}`);
      if (data.partyB.signatoryTitle) lines.push(`${fl.title}: ${data.partyB.signatoryTitle}`);
      lines.push(`${l.date} ____________________`);
      lines.push("");
    }
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
