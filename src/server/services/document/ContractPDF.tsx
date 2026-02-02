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
import type { ContractData } from "./generator";

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
    paddingBottom: 60,
    paddingHorizontal: 60,
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
    textAlign: "justify",
    lineHeight: 1.6,
    marginBottom: 15,
    whiteSpace: "pre-wrap",
  },
  backgroundText: {
    fontSize: 11,
    textAlign: "justify",
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
    textAlign: "justify",
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
    textAlign: "justify",
    lineHeight: 1.6,
    paddingLeft: 20,
    whiteSpace: "pre-wrap",
  },
  legalText: {
    fontSize: 10,
    textAlign: "justify",
    lineHeight: 1.6,
    paddingLeft: 20,
    whiteSpace: "pre-wrap",
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
    textAlign: "justify",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
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
    whiteSpace: "pre-wrap",
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
    height: 20,
    width: 120,
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
    marginBottom: 15,
    textTransform: "uppercase",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    paddingBottom: 5,
  },
});

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface ContractPDFProps {
  data: ContractData;
}

export function ContractPDF({ data }: ContractPDFProps) {
  const hasBoilerplate = data.boilerplate !== null;
  let sectionNumber = 1;

  return (
    <Document
      title={`${data.contractType} - ${data.dealName}`}
      author="Deal Room"
      subject={data.contractType}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {hasBoilerplate
              ? data.boilerplate!.contractTitle
              : data.contractType}
          </Text>
          <Text style={styles.subtitle}>
            Effective Date: {formatDate(data.createdAt)}
          </Text>
        </View>

        {hasBoilerplate ? (
          <>
            {/* Preamble */}
            <View style={styles.section}>
              <Text style={styles.preambleText}>
                {data.boilerplate!.preamble}
              </Text>
            </View>

            {/* Background (if present) */}
            {data.boilerplate!.background && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Background</Text>
                <Text style={styles.backgroundText}>
                  {data.boilerplate!.background}
                </Text>
              </View>
            )}

            {/* Definitions */}
            {data.boilerplate!.definitions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {sectionNumber++}. Definitions
                </Text>
                <Text style={{ fontSize: 10, marginBottom: 10 }}>
                  In this Agreement:
                </Text>
                {data.boilerplate!.definitions.map((def, index) => (
                  <View key={index} style={styles.definitionContainer}>
                    <Text style={styles.definitionText}>
                      <Text style={styles.definitionTerm}>
                        &quot;{def.term}&quot;
                      </Text>{" "}
                      {def.definition}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Standard Clauses from Boilerplate */}
            {data.boilerplate!.standardClauses.map((clause, index) => (
              <View key={`std-${index}`} style={styles.section} wrap={false}>
                <View style={styles.clauseHeader}>
                  <Text style={styles.clauseNumber}>{sectionNumber++}.</Text>
                  <Text style={styles.clauseTitle}>{clause.title}</Text>
                </View>
                <Text style={styles.clauseText}>{clause.text}</Text>
              </View>
            ))}

            {/* Negotiated Terms */}
            {data.clauses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.negotiatedTermsHeader}>
                  {sectionNumber++}. Negotiated Terms
                </Text>
                {data.clauses.map((clause, index) => (
                  <View
                    key={`neg-${index}`}
                    style={styles.clauseContainer}
                    wrap={false}
                  >
                    <View style={styles.clauseHeader}>
                      <Text style={styles.clauseNumber}>
                        {sectionNumber - 1}.{index + 1}
                      </Text>
                      <Text style={styles.clauseTitle}>{clause.title}</Text>
                    </View>
                    <Text style={styles.legalText}>{clause.legalText}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* General Provisions */}
            {data.boilerplate!.generalProvisions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {sectionNumber++}. General Provisions
                </Text>
                {data.boilerplate!.generalProvisions.map((provision, index) => (
                  <View
                    key={`gen-${index}`}
                    style={styles.provisionContainer}
                    wrap={false}
                  >
                    <Text style={styles.provisionTitle}>
                      {sectionNumber - 1}.{index + 1} {provision.title}
                    </Text>
                    <Text style={styles.provisionText}>{provision.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Jurisdiction-Specific Provisions */}
            {data.boilerplate!.jurisdictionProvision && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>
                  {sectionNumber++}.{" "}
                  {data.boilerplate!.jurisdictionProvision.title}
                </Text>
                <Text style={styles.provisionText}>
                  {data.boilerplate!.jurisdictionProvision.text}
                </Text>
              </View>
            )}

            {/* Governing Law Box */}
            <View style={styles.governingLawBox}>
              <Text style={styles.governingLawLabel}>Governing Law</Text>
              <Text style={styles.governingLawText}>{data.governingLaw}</Text>
            </View>

            {/* Signature Section */}
            <View style={styles.signatureSection} wrap={false}>
              <Text style={styles.sectionTitle}>{sectionNumber}. Signatures</Text>
              <Text style={styles.signatureText}>
                IN WITNESS WHEREOF, the parties have executed this Agreement as
                of the Effective Date.
              </Text>
              <View style={styles.signatureGrid}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>
                    {data.boilerplate!.contractTitle.includes("NDA")
                      ? "Party A"
                      : data.boilerplate!.contractTitle.includes("DPA")
                        ? "Controller"
                        : data.boilerplate!.contractTitle.includes("MSA") ||
                            data.boilerplate!.contractTitle.includes("SaaS")
                          ? "Provider"
                          : "Party A"}
                  </Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signaturePartyName}>
                    {data.partyA.company || data.partyA.name}
                  </Text>
                  {data.partyA.company && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
                      {data.partyA.name}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>Date:</Text>
                  <View style={styles.dateLine} />
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>
                    {data.boilerplate!.contractTitle.includes("NDA")
                      ? "Party B"
                      : data.boilerplate!.contractTitle.includes("DPA")
                        ? "Processor"
                        : data.boilerplate!.contractTitle.includes("MSA") ||
                            data.boilerplate!.contractTitle.includes("SaaS")
                          ? "Customer"
                          : "Party B"}
                  </Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signaturePartyName}>
                    {data.partyB.company || data.partyB.name}
                  </Text>
                  {data.partyB.company && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
                      {data.partyB.name}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>Date:</Text>
                  <View style={styles.dateLine} />
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Fallback: Simple format when no boilerplate */}
            {/* Parties */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Parties</Text>
              <View style={styles.partiesGrid}>
                <View style={styles.partyBox}>
                  <Text style={styles.partyLabel}>Party A</Text>
                  <Text style={styles.partyName}>{data.partyA.name}</Text>
                  {data.partyA.company && (
                    <Text style={styles.partyCompany}>
                      {data.partyA.company}
                    </Text>
                  )}
                  <Text style={styles.partyEmail}>{data.partyA.email}</Text>
                </View>
                <View style={styles.partyBox}>
                  <Text style={styles.partyLabel}>Party B</Text>
                  <Text style={styles.partyName}>{data.partyB.name}</Text>
                  {data.partyB.company && (
                    <Text style={styles.partyCompany}>
                      {data.partyB.company}
                    </Text>
                  )}
                  <Text style={styles.partyEmail}>{data.partyB.email}</Text>
                </View>
              </View>
            </View>

            {/* Governing Law */}
            <View style={styles.governingLawBox}>
              <Text style={styles.governingLawLabel}>Governing Law</Text>
              <Text style={styles.governingLawText}>{data.governingLaw}</Text>
            </View>

            {/* Terms and Conditions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Terms and Conditions</Text>
              {data.clauses.map((clause, index) => (
                <View
                  key={index}
                  style={styles.clauseContainer}
                  wrap={false}
                >
                  <View style={styles.clauseHeader}>
                    <Text style={styles.clauseNumber}>{index + 1}.</Text>
                    <Text style={styles.clauseTitle}>{clause.title}</Text>
                  </View>
                  <Text style={styles.legalText}>{clause.legalText}</Text>
                </View>
              ))}
            </View>

            {/* Signature Section */}
            <View style={styles.signatureSection} wrap={false}>
              <Text style={styles.sectionTitle}>Signatures</Text>
              <Text style={{ fontSize: 10, marginBottom: 20 }}>
                IN WITNESS WHEREOF, the parties have executed this Agreement as
                of the date first written above.
              </Text>
              <View style={styles.signatureGrid}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Party A</Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signaturePartyName}>
                    {data.partyA.name}
                  </Text>
                  {data.partyA.company && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
                      {data.partyA.company}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>Date:</Text>
                  <View style={styles.dateLine} />
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Party B</Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signaturePartyName}>
                    {data.partyB.name}
                  </Text>
                  {data.partyB.company && (
                    <Text style={{ fontSize: 9, color: "#666" }}>
                      {data.partyB.company}
                    </Text>
                  )}
                  <Text style={styles.signatureDate}>Date:</Text>
                  <View style={styles.dateLine} />
                </View>
              </View>
            </View>
          </>
        )}

        {/* Footer with page number */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${data.dealName} | Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
