// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Controlled vocabularies for the cross-product experts directory API.
 * Values are String[] in Prisma — validated here at the application layer
 * so that new values can be added without a database migration.
 */

export const SPECIALIZATIONS = [
  "GDPR",
  "CCPA_US_STATE_PRIVACY",
  "DPIA_IMPACT_ASSESSMENTS",
  "DSAR_DATA_SUBJECT_RIGHTS",
  "CROSS_BORDER_TRANSFERS",
  "DPA_VENDOR_CONTRACTS",
  "VENDOR_RISK_MANAGEMENT",
  "INCIDENT_RESPONSE_BREACH_NOTIFICATION",
  "PRIVACY_BY_DESIGN",
  "AI_GOVERNANCE_EU_AI_ACT",
  "EPRIVACY_COOKIE_COMPLIANCE",
  "HEALTHCARE_HIPAA",
  "FINANCIAL_SERVICES_PSD2",
  "CHILDRENS_PRIVACY_AADC",
  "ISO_27001_SOC2_AUDITING",
  "COMPLIANCE_FRAMEWORKS_ROPA",
  "COPYRIGHT_IP",
  "SELF_HOSTING_DEPLOYMENT",
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

/** Human-readable labels keyed by specialization code. */
export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  GDPR: "GDPR",
  CCPA_US_STATE_PRIVACY: "CCPA / US State Privacy",
  DPIA_IMPACT_ASSESSMENTS: "DPIA / Impact Assessments",
  DSAR_DATA_SUBJECT_RIGHTS: "DSAR / Data Subject Rights",
  CROSS_BORDER_TRANSFERS: "Cross-Border Transfers / SCCs / TIA",
  DPA_VENDOR_CONTRACTS: "DPA / Vendor Contracts",
  VENDOR_RISK_MANAGEMENT: "Vendor Risk Management",
  INCIDENT_RESPONSE_BREACH_NOTIFICATION: "Incident Response / Breach Notification",
  PRIVACY_BY_DESIGN: "Privacy by Design",
  AI_GOVERNANCE_EU_AI_ACT: "AI Governance / EU AI Act",
  EPRIVACY_COOKIE_COMPLIANCE: "ePrivacy / Cookie Compliance",
  HEALTHCARE_HIPAA: "Healthcare / HIPAA",
  FINANCIAL_SERVICES_PSD2: "Financial Services / PSD2",
  CHILDRENS_PRIVACY_AADC: "Children's Privacy / AADC",
  ISO_27001_SOC2_AUDITING: "ISO 27001 / SOC 2 Auditing",
  COMPLIANCE_FRAMEWORKS_ROPA: "Compliance Frameworks / ROPA",
  COPYRIGHT_IP: "Copyright / IP",
  SELF_HOSTING_DEPLOYMENT: "Self-Hosting / Deployment",
};

export const CERTIFICATIONS = [
  "CIPP_E",
  "CIPP_US",
  "CIPM",
  "CIPT",
  "CISSP",
  "CISM",
  "ISO_27701_LEAD_AUDITOR",
  "ISO_27001_LEAD_AUDITOR",
  "CDPSE",
  "FIP",
] as const;

export type Certification = (typeof CERTIFICATIONS)[number];

export const CERTIFICATION_LABELS: Record<Certification, string> = {
  CIPP_E: "CIPP/E",
  CIPP_US: "CIPP/US",
  CIPM: "CIPM",
  CIPT: "CIPT",
  CISSP: "CISSP",
  CISM: "CISM",
  ISO_27701_LEAD_AUDITOR: "ISO 27701 Lead Auditor",
  ISO_27001_LEAD_AUDITOR: "ISO 27001 Lead Auditor",
  CDPSE: "CDPSE",
  FIP: "FIP",
};

// "LEGAL" removed 2026-07 — lawyer-expert directory retired. Legacy LEGAL rows
// may persist in the DB; the /api/v1/experts/* routes guard every query with an
// `expertTypes: { hasSome: EXPERT_TYPES }` filter so they are never exposed.
export const EXPERT_TYPES = ["TECHNICAL", "DEPLOYMENT"] as const;
export type ExpertType = (typeof EXPERT_TYPES)[number];

/**
 * Compute a 0–100 profile completeness score.
 * Used for sorting in search results — not stored in the database.
 */
export function computeProfileCompleteness(profile: {
  bio: string | null;
  title: string | null;
  specializations: string[];
  certifications: string[];
  countryCode: string | null;
  city: string | null;
  jurisdictionsCovered: string[];
  contactUrl: string | null;
  user: { image: string | null; name: string | null };
}): number {
  let score = 0;
  const weights = {
    name: 15,
    bio: 20,
    image: 10,
    title: 10,
    specializations: 15,
    certifications: 10,
    location: 5,
    jurisdictionsCovered: 10,
    contactUrl: 5,
  };

  if (profile.user.name) score += weights.name;
  if (profile.bio && profile.bio.length >= 20) score += weights.bio;
  if (profile.user.image) score += weights.image;
  if (profile.title) score += weights.title;
  if (profile.specializations.length > 0) score += weights.specializations;
  if (profile.certifications.length > 0) score += weights.certifications;
  if (profile.countryCode) score += weights.location;
  if (profile.jurisdictionsCovered.length > 0) score += weights.jurisdictionsCovered;
  if (profile.contactUrl) score += weights.contactUrl;

  return score;
}
