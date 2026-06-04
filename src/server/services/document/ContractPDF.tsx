/**
 * Contract PDF Template Component
 *
 * React-PDF component for generating professional legal documents.
 * Renders complete contracts with boilerplate sections and negotiated terms.
 */

import React from "react";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ContractData, CertificationData } from "./generator";
import { brand } from "@/config/brand";

// IBM Plex — a designed superfamily, so the serif body and the sans headers
// are in tune by construction. TTFs are bundled in ./fonts and force-traced
// into the serverless bundle via next.config `outputFileTracingIncludes`.
const FONT_DIR = path.join(process.cwd(), "src/server/services/document/fonts");
const SERIF = "PlexSerif";
const SANS = "PlexSans";

Font.register({
  family: SERIF,
  fonts: [
    { src: path.join(FONT_DIR, "IBMPlexSerif-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "IBMPlexSerif-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "IBMPlexSerif-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONT_DIR, "IBMPlexSerif-Italic.ttf"), fontStyle: "italic" },
  ],
});
Font.register({
  family: SANS,
  fonts: [
    { src: path.join(FONT_DIR, "IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "IBMPlexSans-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "IBMPlexSans-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "IBMPlexSans-Bold.ttf"), fontWeight: 700 },
  ],
});

// Disable react-pdf's default mid-word hyphenation so titles and legal text
// wrap on whole words (e.g. "AGREEMENT" never breaks as "AGREE-MENT").
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    fontFamily: SERIF,
    fontSize: 10.5,
    color: "#1f2933",
    paddingTop: 76,
    paddingBottom: 76,
    paddingLeft: 70,
    paddingRight: 70,
    lineHeight: 1.55,
  },
  header: {
    marginBottom: 30,
    textAlign: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: SANS, fontWeight: 600,
    fontSize: 9.5,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#1a3a5c",
  },
  sectionNumber: {
    fontSize: 12,
    fontWeight: "bold",
  },
  partiesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  partyBox: {
    width: "45%",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "solid",
  },
  partyLabel: {
    fontSize: 9,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  partyName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
  },
  partyCompany: {
    fontSize: 10,
    color: "#333",
    marginBottom: 2,
  },
  partyEmail: {
    fontSize: 9,
    color: "#666",
  },
  preambleText: {
    fontSize: 10.5,
    textAlign: "left",
    lineHeight: 1.6,
    marginBottom: 14,
  },
  backgroundText: {
    fontSize: 10.5,
    textAlign: "left",
    lineHeight: 1.6,
    marginBottom: 14,
  },
  // Definitions use the same hanging grid: term in the left column, definition
  // in the content column, so every term and body share one left edge.
  definitionRow: {
    flexDirection: "row",
    marginBottom: 9,
  },
  definitionTerm: {
    fontSize: 10.5,
    fontWeight: 600,
    width: 120,
    paddingRight: 10,
    color: "#16263a",
  },
  definitionText: {
    flex: 1,
    fontSize: 10.5,
    textAlign: "left",
    lineHeight: 1.55,
  },
  // ---- Hanging-indent grid for numbered clauses/provisions ----
  // The number sits in a fixed 30pt left column and the title fills the rest;
  // the body is a separate block indented to the same left edge as the title
  // (marginLeft 30) so it can page-break freely while staying aligned.
  clauseItem: {
    marginBottom: 13,
  },
  clauseHead: {
    flexDirection: "row",
    marginBottom: 3,
  },
  clauseNum: {
    fontFamily: SANS,
    fontWeight: 600,
    fontSize: 10,
    color: "#1a3a5c",
    width: 30,
  },
  clauseTitle: {
    flex: 1,
    fontFamily: SERIF,
    fontWeight: 600,
    fontSize: 10.5,
    color: "#16263a",
  },
  clauseBody: {
    fontSize: 10.5,
    textAlign: "left",
    lineHeight: 1.6,
    marginLeft: 30,
  },
  // Body for a section-level article (governing law, regulatory provisions):
  // full width under the section header, no hanging number column.
  articleBody: {
    fontSize: 10.5,
    textAlign: "left",
    lineHeight: 1.6,
  },
  annexHeader: {
    marginBottom: 22,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#1a3a5c",
    borderBottomStyle: "solid",
  },
  annexKicker: {
    fontFamily: SANS,
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#8a97a4",
    marginBottom: 5,
  },
  annexTitle: {
    fontFamily: SANS, fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0.3,
    color: "#16263a",
  },
  annexText: {
    fontSize: 10.5,
    textAlign: "left",
    lineHeight: 1.6,
  },
  // ---- Beautifully structured annex bodies ----
  // A numbered ALL-CAPS line (e.g. "1. ENCRYPTION") becomes a sans subheading.
  annexSubhead: {
    fontFamily: SANS,
    fontWeight: 600,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#1a3a5c",
    marginTop: 14,
    marginBottom: 7,
  },
  annexPara: {
    fontSize: 10.5,
    lineHeight: 1.6,
    marginBottom: 5,
  },
  // A lettered item "(a) Label — description" renders the label bold, hanging.
  annexItemRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 6,
  },
  annexItemMarker: {
    width: 18,
    fontSize: 10.5,
    fontWeight: 600,
    color: "#1a3a5c",
  },
  annexItemBody: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.55,
  },
  annexItemLabel: {
    fontWeight: 600,
    color: "#16263a",
  },
  governingLawBox: {
    backgroundColor: "#f4f6f8",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#1a3a5c",
    borderLeftStyle: "solid",
  },
  governingLawLabel: {
    fontFamily: SANS,
    fontSize: 8,
    color: "#8a97a4",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  governingLawText: {
    fontFamily: SERIF,
    fontSize: 12,
    fontWeight: "bold",
    color: "#16263a",
  },
  signatureSection: {
    marginTop: 40,
  },
  signatureText: {
    fontSize: 10.5,
    lineHeight: 1.6,
    marginBottom: 22,
  },
  signatureGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  signatureBox: {
    width: "45%",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    marginBottom: 6,
    height: 40,
    justifyContent: "flex-end",
  },
  signatureScript: {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: 22,
    color: "#1a3a5c",
    marginBottom: 2,
  },
  dateLineSigned: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    height: 36,
    width: 140,
    marginTop: 4,
    paddingBottom: 4,
  },
  dateText: {
    fontSize: 10,
  },
  signatureLabel: {
    fontFamily: SANS,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#8a97a4",
    marginBottom: 4,
  },
  signaturePartyName: {
    fontFamily: SERIF,
    fontSize: 10.5,
    fontWeight: 600,
    color: "#16263a",
  },
  signatureMeta: {
    fontFamily: SANS,
    fontSize: 8.5,
    color: "#5b6b7b",
    marginTop: 1,
  },
  signatureDate: {
    fontFamily: SANS,
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#8a97a4",
    marginTop: 16,
  },
  dateLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    height: 36,
    width: 140,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 60,
    right: 60,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
  },
  pageNumber: {
    fontSize: 9,
    color: "#666",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    marginVertical: 15,
  },
  negotiatedTermsHeader: {
    fontFamily: SANS, fontWeight: 600,
    fontSize: 9.5,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#1a3a5c",
  },
  certificationFooter: {
    position: "absolute",
    bottom: 45,
    left: 60,
    right: 60,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    borderTopStyle: "solid",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  certifiedBadge: {
    fontSize: 7,
    color: "#166534",
    backgroundColor: "#dcfce7",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#166534",
  },
  uncertifiedBadge: {
    fontSize: 7,
    color: "#9a3412",
    backgroundColor: "#fff7ed",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9a3412",
  },
  auditPage: {
    fontFamily: SERIF,
    fontSize: 10,
    paddingTop: 60,
    paddingBottom: 80,
    paddingHorizontal: 60,
    lineHeight: 1.5,
  },
  auditTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  auditRow: {
    flexDirection: "row",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderBottomStyle: "solid",
    paddingBottom: 6,
  },
  auditLabel: {
    fontSize: 9,
    color: "#666",
    width: "30%",
    textTransform: "uppercase",
  },
  auditValue: {
    fontSize: 10,
    width: "70%",
  },
  auditHash: {
    fontSize: 8,
    fontFamily: "Courier",
    color: "#333",
    backgroundColor: "#f5f5f5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 4,
    marginBottom: 12,
  },

  // ---- Cover page ----
  coverPage: {
    fontFamily: SERIF,
    color: "#1a1a1a",
    flexDirection: "column",
  },
  coverTopBar: {
    height: 7,
    backgroundColor: "#1a3a5c",
  },
  coverBody: {
    flexGrow: 1,
    paddingTop: 96,
    paddingBottom: 54,
    paddingHorizontal: 72,
  },
  coverBrand: {
    fontFamily: SANS, fontWeight: 600,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#1a3a5c",
  },
  coverKicker: {
    fontFamily: SANS,
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#8a97a4",
    marginTop: 6,
    marginBottom: 80,
  },
  coverTitle: {
    fontFamily: SERIF,
    fontWeight: "bold",
    fontSize: 30,
    lineHeight: 1.15,
    color: "#16263a",
    marginBottom: 18,
  },
  coverRule: {
    height: 2,
    width: 78,
    backgroundColor: "#1a3a5c",
    marginBottom: 34,
  },
  coverPartiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  coverPartyCol: {
    width: "47%",
  },
  coverMetaLabel: {
    fontFamily: SANS,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#8a97a4",
    marginBottom: 4,
  },
  coverMetaValue: {
    fontFamily: SERIF,
    fontSize: 12.5,
    color: "#1a1a1a",
    marginBottom: 20,
  },
  coverFootRow: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 0.75,
    borderTopColor: "#d8dee4",
    borderTopStyle: "solid",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coverFootText: {
    fontFamily: SANS,
    fontSize: 8,
    color: "#8a97a4",
    letterSpacing: 0.5,
  },

  // ---- Running header / footer ----
  runHeader: {
    position: "absolute",
    top: 28,
    left: 64,
    right: 64,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 5,
    borderBottomWidth: 0.75,
    borderBottomColor: "#d8dee4",
    borderBottomStyle: "solid",
  },
  runHeaderLeft: {
    fontFamily: SANS, fontWeight: 600,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#1a3a5c",
  },
  runHeaderRight: {
    fontFamily: SANS,
    fontSize: 7.5,
    letterSpacing: 0.5,
    color: "#9aa6b2",
  },
  runFooter: {
    position: "absolute",
    bottom: 30,
    left: 64,
    right: 64,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 5,
    borderTopWidth: 0.75,
    borderTopColor: "#d8dee4",
    borderTopStyle: "solid",
  },
  runFootText: {
    fontFamily: SANS,
    fontSize: 7.5,
    color: "#9aa6b2",
    letterSpacing: 0.3,
  },
});

const PDF_LABELS: Record<string, Record<string, string>> = {
  en: {
    effectiveDate: "Effective Date",
    background: "Background",
    definitions: "Definitions",
    inThisAgreement: "In this Agreement:",
    negotiatedTerms: "Negotiated Terms",
    generalProvisions: "General Provisions",
    governingLaw: "Governing Law",
    signatures: "Signatures",
    inWitnessWhereof:
      "IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.",
    date: "Date:",
    parties: "Parties",
    termsAndConditions: "Terms and Conditions",
    page: "Page",
    of: "of",
    partyA: "Party A",
    partyB: "Party B",
    certifiedBy: "Certified by TODO.LAW",
    uncertified: "UNVERIFIED — This document has not been certified",
    auditCertificate: "Audit Certificate",
    documentHash: "Document Hash (SHA-256)",
    certificationId: "Certification ID",
    signatureTimestamps: "Signature Timestamps",
    verificationUrl: "Verification",
    verifyInstructions: "To verify this document, visit the URL above and enter the document hash.",
    confidential: "Private & Confidential",
  },
  es: {
    effectiveDate: "Fecha de Efecto",
    background: "Antecedentes",
    definitions: "Definiciones",
    inThisAgreement: "En el presente Acuerdo:",
    negotiatedTerms: "Términos Negociados",
    generalProvisions: "Disposiciones Generales",
    governingLaw: "Ley Aplicable",
    signatures: "Firmas",
    inWitnessWhereof:
      "EN FE DE LO CUAL, las partes han suscrito el presente Acuerdo en la Fecha de Efecto.",
    date: "Fecha:",
    parties: "Partes",
    termsAndConditions: "Términos y Condiciones",
    page: "Página",
    of: "de",
    partyA: "Parte A",
    partyB: "Parte B",
    certifiedBy: "Certificado por TODO.LAW",
    uncertified: "SIN VERIFICAR — Este documento no ha sido certificado",
    auditCertificate: "Certificado de Auditoría",
    documentHash: "Hash del Documento (SHA-256)",
    certificationId: "ID de Certificación",
    signatureTimestamps: "Marcas de Tiempo de Firma",
    verificationUrl: "Verificación",
    verifyInstructions: "Para verificar este documento, visite la URL anterior e introduzca el hash del documento.",
    confidential: "Privado y Confidencial",
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

/**
 * Renders text that may contain newlines as separate paragraphs.
 * Avoids react-pdf's `whiteSpace: "pre-wrap"` which overflows on large documents.
 */
function ParagraphText({ children, style }: { children: string; style: Style }) {
  const paragraphs = children.split("\n").filter((p) => p.trim() !== "");
  if (paragraphs.length <= 1) {
    return <Text style={style}>{children}</Text>;
  }
  const withMargin: Style = { ...style, marginBottom: 6 };
  return (
    <>
      {paragraphs.map((p, i) => (
        <Text key={i} style={i < paragraphs.length - 1 ? withMargin : style}>
          {p}
        </Text>
      ))}
    </>
  );
}

/** A numbered clause/provision rendered on the shared hanging-indent grid. */
function Clause({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.clauseItem}>
      <View style={styles.clauseHead}>
        <Text style={styles.clauseNum}>{number}</Text>
        <Text style={styles.clauseTitle}>{title}</Text>
      </View>
      <ParagraphText style={styles.clauseBody}>{body}</ParagraphText>
    </View>
  );
}

/** One defined term on the same hanging grid (term column + definition). */
function DefinitionItem({ term, definition }: { term: string; definition: string }) {
  return (
    <View style={styles.definitionRow}>
      <Text style={styles.definitionTerm}>{`“${term}”`}</Text>
      <Text style={styles.definitionText}>{definition}</Text>
    </View>
  );
}

/**
 * Renders an annex body with structure: ALL-CAPS numbered lines become sans
 * subheadings; lettered "(a) Label — description" items render the label bold
 * and hanging; everything else is a plain paragraph.
 */
function AnnexBody({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  return (
    <>
      {lines.map((line, i) => {
        const subhead = /^\d+\.\s+[A-Z0-9 ,/&()-]+$/.test(line);
        if (subhead) {
          return (
            <Text key={i} style={styles.annexSubhead}>
              {line}
            </Text>
          );
        }
        const item = line.match(/^(\([a-z0-9]+\))\s+(.*)$/i);
        if (item) {
          const rest = item[2];
          const dash = rest.indexOf("—");
          const label = dash > -1 ? rest.slice(0, dash).trim() : null;
          const desc = dash > -1 ? rest.slice(dash) : rest;
          return (
            <View key={i} style={styles.annexItemRow}>
              <Text style={styles.annexItemMarker}>{item[1]}</Text>
              <Text style={styles.annexItemBody}>
                {label ? (
                  <>
                    <Text style={styles.annexItemLabel}>{label} </Text>
                    {desc}
                  </>
                ) : (
                  rest
                )}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.annexPara}>
            {line}
          </Text>
        );
      })}
    </>
  );
}

/** Fixed running header repeated on every content/annex page (not the cover). */
function RunningHeader({ title, dealName }: { title: string; dealName: string }) {
  return (
    <View style={styles.runHeader} fixed>
      <Text style={styles.runHeaderLeft}>{title}</Text>
      <Text style={styles.runHeaderRight}>{dealName}</Text>
    </View>
  );
}

/**
 * Fixed running footer: brand wordmark · optional certified mark · page x of y.
 * Page numbering discounts the cover (always the first page) so the first
 * content page reads "Page 1", not "Page 2".
 */
function RunningFooter({
  labels,
  certified,
}: {
  labels: Record<string, string>;
  certified: boolean;
}) {
  return (
    <View style={styles.runFooter} fixed>
      <Text style={styles.runFootText}>{brand.name.toUpperCase()}</Text>
      <Text style={styles.runFootText}>
        {certified ? `✓ ${labels.certifiedBy}` : ""}
      </Text>
      <Text
        style={styles.runFootText}
        render={({ pageNumber, totalPages }) =>
          `${labels.page} ${Math.max(1, pageNumber - 1)} ${labels.of} ${Math.max(1, totalPages - 1)}`
        }
      />
    </View>
  );
}

/** Full-page cover sheet: brand bar, title, parties, key metadata. */
function CoverPage({
  data,
  hasBoilerplate,
  labels,
  lang,
}: {
  data: ContractData;
  hasBoilerplate: boolean;
  labels: Record<string, string>;
  lang: string;
}) {
  const title = hasBoilerplate ? data.boilerplate!.contractTitle : data.contractType;
  const partyALabel = data.boilerplate?.partyLabels?.partyA || labels.partyA;
  const partyBLabel = data.boilerplate?.partyLabels?.partyB || labels.partyB;
  // Prefer the generator-resolved names, which already reflect the solo
  // Controller/Processor swap; fall back to the party objects otherwise.
  const partyAName =
    data.coverPartyAName ||
    data.partyA.legalName ||
    data.partyA.company ||
    data.partyA.name;
  const partyBName =
    data.coverPartyBName ||
    (data.partyB
      ? data.partyB.legalName || data.partyB.company || data.partyB.name
      : "[_________________]");

  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverTopBar} />
      <View style={styles.coverBody}>
        <Text style={styles.coverBrand}>{brand.name}</Text>
        <Text style={styles.coverKicker}>{labels.confidential}</Text>

        <Text style={styles.coverTitle}>{title}</Text>
        <View style={styles.coverRule} />

        <View style={styles.coverPartiesRow}>
          <View style={styles.coverPartyCol}>
            <Text style={styles.coverMetaLabel}>{partyALabel}</Text>
            <Text style={styles.coverMetaValue}>{partyAName}</Text>
          </View>
          <View style={styles.coverPartyCol}>
            <Text style={styles.coverMetaLabel}>{partyBLabel}</Text>
            <Text style={styles.coverMetaValue}>{partyBName}</Text>
          </View>
        </View>

        <Text style={styles.coverMetaLabel}>{labels.effectiveDate}</Text>
        <Text style={styles.coverMetaValue}>{formatDate(data.createdAt, lang)}</Text>

        <Text style={styles.coverMetaLabel}>{labels.governingLaw}</Text>
        <Text style={styles.coverMetaValue}>{data.governingLaw}</Text>

        <View style={styles.coverFootRow}>
          <Text style={styles.coverFootText}>{data.dealName}</Text>
          <Text style={styles.coverFootText}>{brand.name.toUpperCase()}</Text>
        </View>
      </View>
    </Page>
  );
}

interface ContractPDFProps {
  data: ContractData;
}

export function ContractPDF({ data }: ContractPDFProps) {
  const hasBoilerplate = data.boilerplate !== null;
  let sectionNumber = 1;
  const lang = data.language || "en";
  const labels = PDF_LABELS[lang] || PDF_LABELS.en;
  const coverTitle = hasBoilerplate
    ? data.boilerplate!.contractTitle
    : data.contractType;
  const certified = !!data.certification?.certified;

  return (
    <Document
      title={`${data.contractType} - ${data.dealName}`}
      author={brand.name}
      subject={data.contractType}
    >
      {/* Cover sheet */}
      <CoverPage data={data} hasBoilerplate={hasBoilerplate} labels={labels} lang={lang} />

      {/* Page 1: Preamble, Definitions, Standard Clauses */}
      <Page size="A4" style={styles.page}>
        <RunningHeader title={coverTitle} dealName={data.dealName} />

        {hasBoilerplate ? (
          <>
            {/* Preamble */}
            <View style={styles.section}>
              <ParagraphText style={styles.preambleText}>
                {data.boilerplate!.preamble}
              </ParagraphText>
            </View>

            {/* Background (if present) */}
            {data.boilerplate!.background && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{labels.background}</Text>
                <Text style={styles.backgroundText}>
                  {data.boilerplate!.background}
                </Text>
              </View>
            )}

            {/* Definitions */}
            {data.boilerplate!.definitions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {sectionNumber++}. {labels.definitions}
                </Text>
                <Text style={{ fontSize: 10.5, marginBottom: 11, color: "#5b6b7b" }}>
                  {labels.inThisAgreement}
                </Text>
                {data.boilerplate!.definitions.map((def, index) => (
                  <DefinitionItem key={index} term={def.term} definition={def.definition} />
                ))}
              </View>
            )}

            {/* Standard Clauses from Boilerplate */}
            {data.boilerplate!.standardClauses.map((clause, index) => (
              <View key={`std-${index}`} style={styles.section}>
                <Clause number={`${sectionNumber++}.`} title={clause.title} body={clause.text} />
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Fallback: Simple format when no boilerplate */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{labels.parties}</Text>
              <View style={styles.partiesGrid}>
                <View style={styles.partyBox}>
                  <Text style={styles.partyLabel}>{labels.partyA}</Text>
                  <Text style={styles.partyName}>{data.partyA.name}</Text>
                  {data.partyA.company && (
                    <Text style={styles.partyCompany}>
                      {data.partyA.company}
                    </Text>
                  )}
                  <Text style={styles.partyEmail}>{data.partyA.email}</Text>
                </View>
                {data.partyB && (
                <View style={styles.partyBox}>
                  <Text style={styles.partyLabel}>{labels.partyB}</Text>
                  <Text style={styles.partyName}>{data.partyB.name}</Text>
                  {data.partyB.company && (
                    <Text style={styles.partyCompany}>
                      {data.partyB.company}
                    </Text>
                  )}
                  <Text style={styles.partyEmail}>{data.partyB.email}</Text>
                </View>
                )}
              </View>
            </View>

            <View style={styles.governingLawBox}>
              <Text style={styles.governingLawLabel}>{labels.governingLaw}</Text>
              <Text style={styles.governingLawText}>{data.governingLaw}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{labels.termsAndConditions}</Text>
              {data.clauses.map((clause, index) => (
                <Clause key={index} number={`${index + 1}.`} title={clause.title} body={clause.legalText} />
              ))}
            </View>

            <View style={styles.signatureSection} wrap={false}>
              <Text style={styles.sectionTitle}>{labels.signatures}</Text>
              <Text style={{ fontSize: 10, marginBottom: 20 }}>
                {labels.inWitnessWhereof}
              </Text>
              <View style={styles.signatureGrid}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>{labels.partyA}</Text>
                  <View style={styles.signatureLine}>
                    {data.partyA.signature && (
                      <Text style={styles.signatureScript}>{data.partyA.signature}</Text>
                    )}
                  </View>
                  <Text style={styles.signaturePartyName}>
                    {data.partyA.legalName || data.partyA.company || data.partyA.name}
                  </Text>
                  <Text style={styles.signatureMeta}>
                    {data.partyA.signatoryName || data.partyA.name}
                  </Text>
                  {data.partyA.signatoryTitle && (
                    <Text style={styles.signatureMeta}>
                      {data.partyA.signatoryTitle}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>{labels.date}</Text>
                  {data.partyA.signedAt ? (
                    <View style={styles.dateLineSigned}>
                      <Text style={styles.dateText}>
                        {data.partyA.signedAt.toLocaleDateString(data.language === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.dateLine} />
                  )}
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>{labels.partyB}</Text>
                  <View style={styles.signatureLine}>
                    {data.partyB?.signature && (
                      <Text style={styles.signatureScript}>{data.partyB.signature}</Text>
                    )}
                  </View>
                  <Text style={styles.signaturePartyName}>
                    {data.partyB ? (data.partyB.legalName || data.partyB.company || data.partyB.name) : "[_________________]"}
                  </Text>
                  <Text style={styles.signatureMeta}>
                    {data.partyB ? (data.partyB.signatoryName || data.partyB.name) : "[_________________]"}
                  </Text>
                  {data.partyB?.signatoryTitle && (
                    <Text style={styles.signatureMeta}>
                      {data.partyB.signatoryTitle}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>{labels.date}</Text>
                  {data.partyB?.signedAt ? (
                    <View style={styles.dateLineSigned}>
                      <Text style={styles.dateText}>
                        {data.partyB.signedAt.toLocaleDateString(data.language === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.dateLine} />
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        <RunningFooter labels={labels} certified={certified} />
      </Page>

      {/* Page 2: Negotiated Terms, General Provisions, Jurisdiction, Signature (boilerplate contracts only) */}
      {hasBoilerplate && (
        <Page size="A4" style={styles.page}>
          <RunningHeader title={coverTitle} dealName={data.dealName} />
          {/* Negotiated Terms */}
          {data.clauses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.negotiatedTermsHeader}>
                {sectionNumber++}. {labels.negotiatedTerms}
              </Text>
              {data.clauses.map((clause, index) => (
                <Clause
                  key={`neg-${index}`}
                  number={`${sectionNumber - 1}.${index + 1}`}
                  title={clause.title}
                  body={clause.legalText}
                />
              ))}
            </View>
          )}

          {/* General Provisions */}
          {data.boilerplate!.generalProvisions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {sectionNumber++}. {labels.generalProvisions}
              </Text>
              {data.boilerplate!.generalProvisions.map((provision, index) => (
                <Clause
                  key={`gen-${index}`}
                  number={`${sectionNumber - 1}.${index + 1}`}
                  title={provision.title}
                  body={provision.text}
                />
              ))}
            </View>
          )}

          {/* Governing law and jurisdiction — its own top-level article
              (the negotiated forum), replacing the old governing-law box. */}
          {data.governingLawArticle && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {sectionNumber++}. {data.governingLawArticle.title}
              </Text>
              <ParagraphText style={styles.articleBody}>
                {data.governingLawArticle.text}
              </ParagraphText>
            </View>
          )}

          {/* Jurisdiction-specific regulatory provisions (section-format article) */}
          {(data.boilerplate!.jurisdictionProvisions?.length
            ? data.boilerplate!.jurisdictionProvisions
            : data.boilerplate!.jurisdictionProvision
              ? [data.boilerplate!.jurisdictionProvision]
              : []
          ).map((jp, i) => (
            <View key={`reg-${i}`} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {sectionNumber++}. {jp.title}
              </Text>
              <ParagraphText style={styles.articleBody}>{jp.text}</ParagraphText>
            </View>
          ))}

          {/* Signature Section */}
          {data.partyB !== null ? (
            <View style={styles.signatureSection} wrap={false}>
              <Text style={styles.sectionTitle}>{sectionNumber}. {labels.signatures}</Text>
              <Text style={styles.signatureText}>
                {labels.inWitnessWhereof}
              </Text>
              <View style={styles.signatureGrid}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>
                    {data.boilerplate!.partyLabels?.partyA || labels.partyA}
                  </Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signaturePartyName}>
                    {data.partyA.legalName || data.partyA.company || data.partyA.name}
                  </Text>
                  <Text style={styles.signatureMeta}>
                    {data.partyA.signatoryName || data.partyA.name}
                  </Text>
                  {data.partyA.signatoryTitle && (
                    <Text style={styles.signatureMeta}>
                      {data.partyA.signatoryTitle}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>{labels.date}</Text>
                  <View style={styles.dateLine} />
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>
                    {data.boilerplate!.partyLabels?.partyB || labels.partyB}
                  </Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signaturePartyName}>
                    {data.partyB.legalName || data.partyB.company || data.partyB.name}
                  </Text>
                  <Text style={styles.signatureMeta}>
                    {data.partyB.signatoryName || data.partyB.name}
                  </Text>
                  {data.partyB.signatoryTitle && (
                    <Text style={styles.signatureMeta}>
                      {data.partyB.signatoryTitle}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>{labels.date}</Text>
                  <View style={styles.dateLine} />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.signatureSection} wrap={false}>
              <View style={styles.divider} />
              <Text style={styles.signatureText}>
                {data.boilerplate!.signatureBlock}
              </Text>
            </View>
          )}

          <RunningFooter labels={labels} certified={certified} />
        </Page>
      )}

      {/* Annex pages — each annex on its own page, AFTER the signature blocks.
          The annex bodies (Description of Processing, Technical & Organisational
          Measures, etc.) are part of the agreement but, by convention, follow
          the signatures rather than sitting mid-document as numbered articles. */}
      {hasBoilerplate &&
        data.boilerplate!.annexes?.map((annex, i) => {
          const [annexLabel, ...rest] = annex.title.split("—");
          const annexBody = rest.join("—").trim();
          return (
            <Page key={`annex-${i}`} size="A4" style={styles.page}>
              <RunningHeader title={coverTitle} dealName={data.dealName} />
              <View style={styles.annexHeader}>
                {annexBody ? (
                  <>
                    <Text style={styles.annexKicker}>{annexLabel.trim()}</Text>
                    <Text style={styles.annexTitle}>{annexBody}</Text>
                  </>
                ) : (
                  <Text style={styles.annexTitle}>{annex.title}</Text>
                )}
              </View>
              <AnnexBody text={annex.text} />
              <RunningFooter labels={labels} certified={certified} />
            </Page>
          );
        })}

      {/* Audit Certificate Page (only when certified) */}
      {data.certification?.certified && (
        <AuditCertificatePage certification={data.certification} labels={labels} dealName={data.dealName} />
      )}
    </Document>
  );
}

function AuditCertificatePage({
  certification,
  labels,
  dealName,
}: {
  certification: CertificationData;
  labels: Record<string, string>;
  dealName: string;
}) {
  return (
    <Page size="A4" style={styles.auditPage}>
      <View style={{ marginBottom: 30, textAlign: "center" }}>
        <Text style={styles.auditTitle}>{labels.auditCertificate}</Text>
        <Text style={{ fontSize: 9, color: "#666", textAlign: "center" }}>
          {dealName}
        </Text>
      </View>

      {/* Document Hash */}
      <View style={{ marginBottom: 20 }}>
        <View style={styles.auditRow}>
          <Text style={styles.auditLabel}>{labels.documentHash}</Text>
          <Text style={styles.auditValue}> </Text>
        </View>
        <Text style={styles.auditHash}>{certification.documentHash}</Text>
      </View>

      {/* Certification ID */}
      <View style={styles.auditRow}>
        <Text style={styles.auditLabel}>{labels.certificationId}</Text>
        <Text style={styles.auditValue}>{certification.ceremonyId}</Text>
      </View>

      {/* Signature Timestamps */}
      <View style={{ marginTop: 20, marginBottom: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 10 }}>
          {labels.signatureTimestamps}
        </Text>
        {certification.timestamps.map((ts, i) => (
          <View key={i} style={{ marginBottom: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#166534", borderLeftStyle: "solid" }}>
            <Text style={{ fontSize: 10, fontWeight: "bold" }}>
              {ts.partyRole === "INITIATOR" ? "Party A" : "Party B"}
            </Text>
            <Text style={styles.signatureMeta}>
              Signed: {ts.signedAt}
            </Text>
            <Text style={{ fontSize: 8, color: "#999", fontFamily: "Courier" }}>
              RFC 3161: {ts.rfc3161Timestamp || "N/A"}
            </Text>
          </View>
        ))}
      </View>

      {/* Verification URL */}
      {certification.verificationUrl && (
        <View style={{ marginTop: 20, padding: 12, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", borderStyle: "solid" }}>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>{labels.verificationUrl}</Text>
            <Text style={{ ...styles.auditValue, color: "#166534" }}>
              {certification.verificationUrl}
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: "#666", marginTop: 4 }}>
            {labels.verifyInstructions}
          </Text>
        </View>
      )}

      {/* Footer */}
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `${labels.auditCertificate} | ${labels.page} ${pageNumber} ${labels.of} ${totalPages}`
        }
        fixed
      />
    </Page>
  );
}
