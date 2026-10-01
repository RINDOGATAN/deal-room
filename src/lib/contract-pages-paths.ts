// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The list of public contract pages and their addresses. No file-system
 * access, so the browser can use it too; the content itself is read by
 * `contract-pages.ts`.
 */

export type PageLocale = "en" | "es";
export const PAGE_LOCALES: readonly PageLocale[] = ["en", "es"];

export const SITE_URL = "https://dealroom.todo.law";

/** The index groups, in display order. */
export const CONTRACT_GROUPS = [
  { id: "commercial", name: { en: "Commercial and technology", es: "Comercial y tecnología" } },
  { id: "privacy", name: { en: "Data protection and privacy", es: "Protección de datos y privacidad" } },
  { id: "team", name: { en: "Team and services", es: "Equipo y servicios" } },
  { id: "startups", name: { en: "Startups and investment", es: "Startups e inversión" } },
  { id: "marketing", name: { en: "Marketing and distribution", es: "Marketing y distribución" } },
  { id: "corporate-spain", name: { en: "Spanish company law", es: "Derecho societario español" } },
  { id: "property", name: { en: "Property", es: "Inmobiliario" } },
] as const;
export type ContractGroupId = (typeof CONTRACT_GROUPS)[number]["id"];

export interface ContractPageDef {
  slug: string;
  contractType: string;
  group: ContractGroupId;
}

/** Every page: one per contract type of the hosted catalogue. */
export const CONTRACT_PAGES: readonly ContractPageDef[] = [
  { slug: "nda", contractType: "NDA", group: "commercial" },
  { slug: "master-services-agreement", contractType: "MSA", group: "commercial" },
  { slug: "saas-agreement", contractType: "SAAS", group: "commercial" },
  { slug: "software-development-agreement", contractType: "SOFTWARE_DEVELOPMENT", group: "commercial" },
  { slug: "technology-license-agreement", contractType: "TECHNOLOGY_LICENSE", group: "commercial" },
  { slug: "joint-venture-agreement", contractType: "JOINT_VENTURE", group: "commercial" },
  { slug: "data-processing-agreement", contractType: "DPA", group: "privacy" },
  { slug: "privacy-notice", contractType: "PRIVACY_NOTICE", group: "privacy" },
  { slug: "business-associate-agreement", contractType: "BAA_NEGOTIATOR", group: "privacy" },
  { slug: "data-licensing-agreement", contractType: "DATA_LICENSING", group: "privacy" },
  { slug: "consulting-agreement", contractType: "CONSULTING", group: "team" },
  { slug: "services-agreement-spain", contractType: "CONTRATO_SERVICIOS", group: "team" },
  { slug: "employment-agreement", contractType: "EMPLOYMENT", group: "team" },
  { slug: "employment-contract-spain", contractType: "CONTRATO_LABORAL", group: "team" },
  { slug: "ip-assignment-agreement", contractType: "IP_ASSIGNMENT", group: "team" },
  { slug: "ip-assignment-spain", contractType: "CESION_PI", group: "team" },
  { slug: "advisory-agreement", contractType: "ADVISORY", group: "team" },
  { slug: "delaware-certificate-of-incorporation", contractType: "DELAWARE_CERT_OF_INCORPORATION", group: "startups" },
  { slug: "founders-agreement", contractType: "FOUNDERS", group: "startups" },
  { slug: "term-sheet", contractType: "TERM_SHEET", group: "startups" },
  { slug: "convertible-note", contractType: "CONVERTIBLE_NOTE", group: "startups" },
  { slug: "safe-agreement", contractType: "SAFE", group: "startups" },
  { slug: "seed-investment-agreement", contractType: "SEED_INVESTMENT", group: "startups" },
  { slug: "shareholders-agreement", contractType: "SHAREHOLDERS", group: "startups" },
  { slug: "shareholders-agreement-spain", contractType: "PACTO_SOCIOS", group: "startups" },
  { slug: "equity-incentive-plan", contractType: "EQUITY_INCENTIVE", group: "startups" },
  { slug: "advertising-insertion-order", contractType: "ADVERTISING_IO", group: "marketing" },
  { slug: "affiliate-agreement", contractType: "AFFILIATE_PROGRAM", group: "marketing" },
  { slug: "influencer-marketing-agreement", contractType: "INFLUENCER_MARKETING", group: "marketing" },
  { slug: "reseller-agreement", contractType: "WHITE_LABEL_RESELLER", group: "marketing" },
  { slug: "board-minutes-spain", contractType: "ACTA_CONSEJO_ADMINISTRACION", group: "corporate-spain" },
  { slug: "general-meeting-minutes-spain", contractType: "ACTA_JUNTA_GENERAL", group: "corporate-spain" },
  { slug: "phantom-shares-plan", contractType: "PHANTOM_SHARES_PLAN", group: "corporate-spain" },
  { slug: "phantom-shares-grant", contractType: "PHANTOM_SHARES_GRANT", group: "corporate-spain" },
  { slug: "residential-lease-spain", contractType: "RESIDENTIAL_TENANCY_ES", group: "property" },
  { slug: "assured-periodic-tenancy", contractType: "RESIDENTIAL_TENANCY_GB", group: "property" },
  { slug: "california-residential-lease", contractType: "RESIDENTIAL_TENANCY_US_CA", group: "property" },
];

export function pageForSlug(slug: string): ContractPageDef | undefined {
  return CONTRACT_PAGES.find((p) => p.slug === slug);
}

/** Path of a page (or of the index, without a slug) in a language. */
export function contractPath(locale: PageLocale, slug?: string): string {
  const base = locale === "es" ? "/es/contracts" : "/contracts";
  return slug ? `${base}/${slug}` : base;
}
