// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One outline of a contract for the agent-native formats (Markdown and
 * HTML), built from the same `ContractData` that feeds the PDF, DOCX and
 * TXT renderers, in the TXT order: title, agent notice, preamble, parties,
 * background, definitions, clauses, general provisions, governing law,
 * jurisdiction provisions, signatures, annexes. Both renderers walk this
 * outline, so they cannot list different content.
 */

import { buildSequentialSections, type ContractData, type PartyData } from "./generator";
import { LABELS, formatDate } from "./contractTxt";
import { agentNoticeParagraphs } from "./agentNotice";

const FIELD_LABELS: Record<string, Record<string, string>> = {
  en: {
    legalName: "Legal name",
    address: "Address",
    taxId: "Tax ID",
    contact: "Contact",
    name: "Name",
    title: "Title",
    date: "Date",
  },
  es: {
    legalName: "Nombre o denominación",
    address: "Domicilio",
    taxId: "Identificación fiscal",
    contact: "Contacto",
    name: "Nombre",
    title: "Cargo",
    date: "Fecha",
  },
};

export const BLANK_LINE = "____________________";

export interface OutlineSection {
  id: string;
  /** "1", "2"... for numbered clauses. */
  number?: string;
  title: string;
  /** Paragraphs of body text (split on blank lines; single line breaks kept). */
  paragraphs: string[];
  /** Term and definition pairs (the definitions section only). */
  definitions?: { term: string; definition: string }[];
  /** Nested sections (the negotiated terms group). */
  children?: OutlineSection[];
}

export interface OutlineParty {
  id: string;
  label: string;
  name: string;
  fields: { label: string; value: string }[];
}

export interface ContractOutline {
  lang: string;
  title: string;
  meta: { label: string; value: string }[];
  notice: string[];
  preamble: string | null;
  partiesTitle: string;
  parties: OutlineParty[];
  sections: OutlineSection[];
  signatures: {
    title: string;
    intro: string;
    blocks: { id: string; label: string; fields: { label: string; value: string }[] }[];
  };
  annexes: OutlineSection[];
}

/** A lower-case, ASCII anchor fragment. */
export function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

export function paragraphs(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\f/g, "").trim())
    .filter(Boolean);
}

export function buildContractOutline(data: ContractData): ContractOutline {
  const lang = data.language || "en";
  const l = LABELS[lang] || LABELS.en;
  const f = FIELD_LABELS[lang] || FIELD_LABELS.en;
  const bp = data.boilerplate;
  const partyALabel = bp?.partyLabels?.partyA || l.partyA;
  const partyBLabel = bp?.partyLabels?.partyB || l.partyB;

  const used = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  ["notice", "preamble", "parties", "signatures"].forEach((id) => used.add(id));

  const party = (id: string, label: string, p: PartyData): OutlineParty => {
    const fields: { label: string; value: string }[] = [];
    if (p.legalName) fields.push({ label: f.legalName, value: p.legalName });
    if (p.address) fields.push({ label: f.address, value: p.address });
    if (p.taxId) fields.push({ label: f.taxId, value: p.taxId });
    const contact = p.email ? `${p.name} (${p.email})` : p.name;
    if (contact) fields.push({ label: f.contact, value: contact });
    return { id, label, name: p.company || p.name, fields };
  };

  const sections: OutlineSection[] = [];
  if (bp?.background) {
    sections.push({ id: uniqueId("background"), title: l.background, paragraphs: paragraphs(bp.background) });
  }
  if (bp?.definitions?.length) {
    sections.push({
      id: uniqueId("definitions"),
      title: l.definitions,
      paragraphs: [],
      definitions: bp.definitions.map((d) => ({ term: d.term, definition: d.definition })),
    });
  }

  if (bp?.sequentialNumbering === true) {
    for (const s of buildSequentialSections(data)) {
      sections.push({
        id: uniqueId(`section-${s.sectionNumber}`),
        number: String(s.sectionNumber),
        title: s.title,
        paragraphs: paragraphs(s.body),
      });
    }
  } else {
    if (data.clauses.length > 0) {
      sections.push({
        id: uniqueId("negotiated-terms"),
        title: l.negotiatedTerms,
        paragraphs: [],
        children: data.clauses.map((c, i) => ({
          id: uniqueId(`clause-${c.clauseId ? slugify(c.clauseId) : slugify(c.title)}`),
          number: String(i + 1),
          title: c.title,
          paragraphs: paragraphs(c.legalText),
        })),
      });
    }
    for (const sc of bp?.standardClauses ?? []) {
      sections.push({
        id: uniqueId(slugify(sc.title)),
        title: sc.title,
        paragraphs: [...paragraphs(sc.text), ...(sc.source ? [`[${sc.source}]`] : [])],
      });
    }
  }

  if (bp?.generalProvisions?.length) {
    sections.push({
      id: uniqueId("general-provisions"),
      title: l.generalProvisions,
      paragraphs: [],
      children: bp.generalProvisions.map((gp) => ({
        id: uniqueId(slugify(gp.title)),
        title: gp.title,
        paragraphs: paragraphs(gp.text),
      })),
    });
  }

  if (data.governingLawArticle) {
    sections.push({
      id: uniqueId("governing-law"),
      title: data.governingLawArticle.title,
      paragraphs: paragraphs(data.governingLawArticle.text),
    });
  }

  const jpList = bp?.jurisdictionProvisions?.length
    ? bp.jurisdictionProvisions
    : bp?.jurisdictionProvision
      ? [bp.jurisdictionProvision]
      : [];
  for (const jp of jpList) {
    sections.push({ id: uniqueId(slugify(jp.title)), title: jp.title, paragraphs: paragraphs(jp.text) });
  }

  const signer = (id: string, label: string, p: PartyData) => ({
    id,
    label,
    fields: [
      { label: f.name, value: p.signatoryName || p.name },
      ...(p.signatoryTitle ? [{ label: f.title, value: p.signatoryTitle }] : []),
      { label: f.date, value: BLANK_LINE },
    ],
  });

  return {
    lang,
    title: bp?.contractTitle || data.dealName,
    meta: [
      { label: l.effectiveDate, value: formatDate(data.createdAt, lang) },
      { label: l.governingLaw, value: data.governingLaw },
    ],
    notice: agentNoticeParagraphs(data),
    preamble: bp?.preamble?.trim() || null,
    partiesTitle: l.parties,
    parties: [
      party("party-a", partyALabel, data.partyA),
      ...(data.partyB ? [party("party-b", partyBLabel, data.partyB)] : []),
    ],
    sections,
    signatures: {
      title: l.signatures,
      intro: bp?.signatureBlock || l.inWitnessWhereof,
      blocks: [
        signer("signature-party-a", partyALabel, data.partyA),
        ...(data.partyB ? [signer("signature-party-b", partyBLabel, data.partyB)] : []),
      ],
    },
    annexes: (bp?.annexes ?? []).map((a) => ({
      id: uniqueId(`annex-${slugify(a.title)}`),
      title: a.title,
      paragraphs: paragraphs(a.text),
    })),
  };
}
