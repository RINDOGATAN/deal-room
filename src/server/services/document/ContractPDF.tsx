/**
 * Contract PDF Template Component
 *
 * React-PDF component for generating professional legal documents.
 * Renders complete contracts with boilerplate sections and negotiated terms.
 */

import React from "react";
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

// Register fonts (using built-in fonts for simplicity)
Font.register({
  family: "Times-Roman",
  fonts: [
    { src: "Times-Roman" },
    { src: "Times-Bold", fontWeight: "bold" },
    { src: "Times-Italic", fontStyle: "italic" },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    paddingTop: 60,
    paddingBottom: 80,
    paddingLeft: 72,
    paddingRight: 60,
    lineHeight: 1.5,
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
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    textTransform: "uppercase",
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
    fontSize: 11,
    textAlign: "left",
    lineHeight: 1.6,
    marginBottom: 15,
  },
  backgroundText: {
    fontSize: 11,
    textAlign: "left",
    lineHeight: 1.6,
    marginBottom: 15,
  },
  definitionContainer: {
    marginBottom: 10,
    paddingLeft: 10,
  },
  definitionTerm: {
    fontSize: 11,
    fontWeight: "bold",
  },
  definitionText: {
    fontSize: 10,
    textAlign: "left",
    lineHeight: 1.5,
  },
  clauseContainer: {
    marginBottom: 16,
  },
  clauseHeader: {
    flexDirection: "row",
    marginBottom: 6,
  },
  clauseNumber: {
    fontSize: 11,
    fontWeight: "bold",
    marginRight: 8,
  },
  clauseTitle: {
    fontSize: 11,
    fontWeight: "bold",
  },
  clauseText: {
    fontSize: 10,
    textAlign: "left",
    lineHeight: 1.6,
    paddingLeft: 20,
  },
  legalText: {
    fontSize: 10,
    textAlign: "left",
    lineHeight: 1.6,
    paddingLeft: 20,
  },
  provisionContainer: {
    marginBottom: 12,
  },
  provisionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
  },
  provisionText: {
    fontSize: 10,
    textAlign: "left",
    lineHeight: 1.6,
    paddingLeft: 20,
  },
  governingLawBox: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    marginBottom: 20,
  },
  governingLawLabel: {
    fontSize: 9,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  governingLawText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  signatureSection: {
    marginTop: 40,
  },
  signatureText: {
    fontSize: 10,
    marginBottom: 20,
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
    fontFamily: "Times-Italic",
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
    fontSize: 9,
    color: "#666",
    marginBottom: 4,
  },
  signaturePartyName: {
    fontSize: 10,
    fontWeight: "bold",
  },
  signatureDate: {
    fontSize: 9,
    color: "#666",
    marginTop: 15,
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
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    textTransform: "uppercase",
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
    fontFamily: "Times-Roman",
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

interface ContractPDFProps {
  data: ContractData;
}

export function ContractPDF({ data }: ContractPDFProps) {
  const hasBoilerplate = data.boilerplate !== null;
  let sectionNumber = 1;
  const lang = data.language || "en";
  const labels = PDF_LABELS[lang] || PDF_LABELS.en;

  return (
    <Document
      title={`${data.contractType} - ${data.dealName}`}
      author={brand.name}
      subject={data.contractType}
    >
      {/* Page 1: Header, Preamble, Definitions, Standard Clauses */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {hasBoilerplate
              ? data.boilerplate!.contractTitle
              : data.contractType}
          </Text>
          <Text style={styles.subtitle}>
            {lang === "es"
              ? formatDate(data.createdAt, lang)
              : `${labels.effectiveDate}: ${formatDate(data.createdAt, lang)}`}
          </Text>
        </View>

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
                <Text style={{ fontSize: 10, marginBottom: 10 }}>
                  {labels.inThisAgreement}
                </Text>
                {data.boilerplate!.definitions.map((def, index) => (
                  <View key={index} style={styles.definitionContainer}>
                    <Text style={styles.definitionTerm}>
                      &quot;{def.term}&quot;
                    </Text>
                    <ParagraphText style={styles.definitionText}>
                      {def.definition}
                    </ParagraphText>
                  </View>
                ))}
              </View>
            )}

            {/* Standard Clauses from Boilerplate */}
            {data.boilerplate!.standardClauses.map((clause, index) => (
              <View key={`std-${index}`} style={styles.section}>
                <View style={styles.clauseHeader}>
                  <Text style={styles.clauseNumber}>{sectionNumber++}.</Text>
                  <Text style={styles.clauseTitle}>{clause.title}</Text>
                </View>
                <ParagraphText style={styles.clauseText}>{clause.text}</ParagraphText>
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
                <View key={index} style={styles.clauseContainer}>
                  <View style={styles.clauseHeader}>
                    <Text style={styles.clauseNumber}>{index + 1}.</Text>
                    <Text style={styles.clauseTitle}>{clause.title}</Text>
                  </View>
                  <Text style={styles.legalText}>{clause.legalText}</Text>
                </View>
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
                  <Text style={{ fontSize: 9, color: "#666" }}>
                    {data.partyA.signatoryName || data.partyA.name}
                  </Text>
                  {data.partyA.signatoryTitle && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
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
                  <Text style={{ fontSize: 9, color: "#666" }}>
                    {data.partyB ? (data.partyB.signatoryName || data.partyB.name) : "[_________________]"}
                  </Text>
                  {data.partyB?.signatoryTitle && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
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

        {/* Certification footer \u2014 rendered only when the document was
            actually certified by the cryptographic-timestamping pipeline.
            Without a real certificate we used to print a red "UNVERIFIED"
            badge, which felt accusatory; better to print nothing while
            we wait for the Firmas integration. */}
        {data.certification?.certified && (
          <View style={styles.certificationFooter} fixed>
            <Text style={styles.certifiedBadge}>
              {`\u2713 ${labels.certifiedBy}`}
            </Text>
            <Text style={{ fontSize: 7, color: "#999" }}>
              {data.certification?.documentHash
                ? `SHA-256: ${data.certification.documentHash.slice(0, 16)}...`
                : ""}
            </Text>
          </View>
        )}

        {/* Footer with page number */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${data.dealName} | ${labels.page} ${pageNumber} ${labels.of} ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* Page 2: Negotiated Terms, General Provisions, Jurisdiction, Signature (boilerplate contracts only) */}
      {hasBoilerplate && (
        <Page size="A4" style={styles.page}>
          {/* Negotiated Terms */}
          {data.clauses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.negotiatedTermsHeader}>
                {sectionNumber++}. {labels.negotiatedTerms}
              </Text>
              {data.clauses.map((clause, index) => (
                <View
                  key={`neg-${index}`}
                  style={styles.clauseContainer}
                >
                  <View style={styles.clauseHeader}>
                    <Text style={styles.clauseNumber}>
                      {sectionNumber - 1}.{index + 1}
                    </Text>
                    <Text style={styles.clauseTitle}>{clause.title}</Text>
                  </View>
                  <ParagraphText style={styles.legalText}>{clause.legalText}</ParagraphText>
                </View>
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
                <View
                  key={`gen-${index}`}
                  style={styles.clauseContainer}
                >
                  <View style={styles.clauseHeader}>
                    <Text style={styles.clauseNumber}>
                      {sectionNumber - 1}.{index + 1}
                    </Text>
                    <Text style={styles.clauseTitle}>{provision.title}</Text>
                  </View>
                  <ParagraphText style={styles.provisionText}>{provision.text}</ParagraphText>
                </View>
              ))}
            </View>
          )}

          {/* Jurisdiction-Specific Provisions */}
          {data.boilerplate!.jurisdictionProvisions?.length ? (
            data.boilerplate!.jurisdictionProvisions.map((jp, i) => (
              <View key={i} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {sectionNumber++}. {jp.title}
                </Text>
                <ParagraphText style={styles.provisionText}>{jp.text}</ParagraphText>
              </View>
            ))
          ) : data.boilerplate!.jurisdictionProvision ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {sectionNumber++}.{" "}
                {data.boilerplate!.jurisdictionProvision.title}
              </Text>
              <ParagraphText style={styles.provisionText}>
                {data.boilerplate!.jurisdictionProvision.text}
              </ParagraphText>
            </View>
          ) : null}

          {/* Governing Law Box */}
          <View style={styles.governingLawBox}>
            <Text style={styles.governingLawLabel}>{labels.governingLaw}</Text>
            <Text style={styles.governingLawText}>{data.governingLaw}</Text>
          </View>

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
                  <Text style={{ fontSize: 9, color: "#666" }}>
                    {data.partyA.signatoryName || data.partyA.name}
                  </Text>
                  {data.partyA.signatoryTitle && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
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
                  <Text style={{ fontSize: 9, color: "#666" }}>
                    {data.partyB.signatoryName || data.partyB.name}
                  </Text>
                  {data.partyB.signatoryTitle && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
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

          {/* Certification footer \u2014 only when actually certified. */}
          {data.certification?.certified && (
            <View style={styles.certificationFooter} fixed>
              <Text style={styles.certifiedBadge}>
                {`\u2713 ${labels.certifiedBy}`}
              </Text>
              <Text style={{ fontSize: 7, color: "#999" }}>
                {data.certification?.documentHash
                  ? `SHA-256: ${data.certification.documentHash.slice(0, 16)}...`
                  : ""}
              </Text>
            </View>
          )}

          {/* Footer with page number */}
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) =>
              `${data.dealName} | ${labels.page} ${pageNumber} ${labels.of} ${totalPages}`
            }
            fixed
          />
        </Page>
      )}

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
            <Text style={{ fontSize: 9, color: "#666" }}>
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
