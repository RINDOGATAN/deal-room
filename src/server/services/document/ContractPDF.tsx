/**
 * Contract PDF Template Component
 *
 * React-PDF component for generating professional legal documents.
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
    fontSize: 18,
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
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    paddingBottom: 4,
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
  clauseContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderBottomStyle: "solid",
  },
  clauseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  clauseNumber: {
    fontSize: 10,
    fontWeight: "bold",
    marginRight: 8,
  },
  clauseTitle: {
    fontSize: 11,
    fontWeight: "bold",
    flex: 1,
  },
  clauseCategory: {
    fontSize: 9,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clauseOption: {
    fontSize: 10,
    color: "#444",
    marginBottom: 6,
    fontStyle: "italic",
  },
  legalText: {
    fontSize: 10,
    textAlign: "justify",
    lineHeight: 1.6,
  },
  signatureSection: {
    marginTop: 40,
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
  return (
    <Document
      title={`${data.contractType} - ${data.dealName}`}
      author="Deal Room"
      subject={data.contractType}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{data.contractType}</Text>
          <Text style={styles.subtitle}>
            Effective Date: {formatDate(data.createdAt)}
          </Text>
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parties</Text>
          <View style={styles.partiesGrid}>
            <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>Party A (Disclosing Party)</Text>
              <Text style={styles.partyName}>{data.partyA.name}</Text>
              {data.partyA.company && (
                <Text style={styles.partyCompany}>{data.partyA.company}</Text>
              )}
              <Text style={styles.partyEmail}>{data.partyA.email}</Text>
            </View>
            <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>Party B (Receiving Party)</Text>
              <Text style={styles.partyName}>{data.partyB.name}</Text>
              {data.partyB.company && (
                <Text style={styles.partyCompany}>{data.partyB.company}</Text>
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
            <View key={index} style={styles.clauseContainer} wrap={false}>
              <View style={styles.clauseHeader}>
                <Text style={styles.clauseNumber}>{index + 1}.</Text>
                <Text style={styles.clauseTitle}>{clause.title}</Text>
                <Text style={styles.clauseCategory}>{clause.category}</Text>
              </View>
              <Text style={styles.clauseOption}>
                Selected Option: {clause.agreedOption}
              </Text>
              <Text style={styles.legalText}>{clause.legalText}</Text>
            </View>
          ))}
        </View>

        {/* Signature Section */}
        <View style={styles.signatureSection} wrap={false}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <Text style={{ fontSize: 10, marginBottom: 20 }}>
            IN WITNESS WHEREOF, the parties have executed this Agreement as of
            the date first written above.
          </Text>
          <View style={styles.signatureGrid}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Party A</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signaturePartyName}>{data.partyA.name}</Text>
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
              <Text style={styles.signaturePartyName}>{data.partyB.name}</Text>
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
