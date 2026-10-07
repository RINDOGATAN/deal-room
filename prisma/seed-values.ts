// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The values the seed writes for a skill's clauses and options, from the
 * skill's JSON. Shared by prisma/seed.ts (which writes them) and
 * scripts/seed-preview.ts (which compares them, read-only, with a
 * database), so the preview cannot drift from the seed.
 */

import { optionProsCons } from "./option-pros-cons";

export interface JurisdictionRule {
  available: boolean;
  warning?: string;
  note?: string;
}

export interface JurisdictionConfig {
  [key: string]: JurisdictionRule | undefined;
  CALIFORNIA?: JurisdictionRule;
  ENGLAND_WALES?: JurisdictionRule;
  SPAIN?: JurisdictionRule;
}

export interface ClauseOption {
  id: string;
  code: string;
  label: LocalizedString;
  order: number;
  plainDescription: LocalizedString;
  // Either layout; read through optionProsCons(), never directly.
  pros?: { partyA?: LocalizedArray; partyB?: LocalizedArray };
  cons?: { partyA?: LocalizedArray; partyB?: LocalizedArray };
  prosPartyA?: LocalizedArray;
  consPartyA?: LocalizedArray;
  prosPartyB?: LocalizedArray;
  consPartyB?: LocalizedArray;
  legalText: LocalizedString;
  biasPartyA: number;
  biasPartyB: number;
  jurisdictionConfig?: JurisdictionConfig;
}

export interface Clause {
  id: string;
  title: LocalizedString;
  category: LocalizedString;
  order: number;
  plainDescription: LocalizedString;
  legalContext?: LocalizedString;
  isRequired?: boolean;
  options: ClauseOption[];
}

export type LocalizedString = string | Record<string, string>;
export type LocalizedArray = string[] | Record<string, string[]>;

export interface SkillClauses {
  contractType: string;
  displayName: LocalizedString;
  description?: LocalizedString;
  version: string;
  clauses: Clause[];
}

// Resolve i18n value to a flat string (default language: "en")
export function resolveString(value: string | Record<string, string> | undefined, fallback = ""): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.en || Object.values(value)[0] || fallback;
}

// Resolve i18n array to a flat string array (default language: "en")
export function resolveArray(value: string[] | Record<string, string[]> | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.en || Object.values(value)[0] || [];
}

// Check if a value is a localized object (not a plain string/array)
export function isLocalized(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Build localizedContent JSON for a ClauseTemplate if it has i18n content
export function buildClauseLocalizedContent(clause: Clause): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  if (isLocalized(clause.title)) { content.title = clause.title; hasLocalized = true; }
  if (isLocalized(clause.category)) { content.category = clause.category; hasLocalized = true; }
  if (isLocalized(clause.plainDescription)) { content.plainDescription = clause.plainDescription; hasLocalized = true; }
  if (clause.legalContext && isLocalized(clause.legalContext)) { content.legalContext = clause.legalContext; hasLocalized = true; }

  return hasLocalized ? content : undefined;
}

// Build localizedContent JSON for a ClauseOption if it has i18n content
export function buildOptionLocalizedContent(option: ClauseOption): Record<string, unknown> | undefined {
  const content: Record<string, unknown> = {};
  let hasLocalized = false;

  if (isLocalized(option.label)) { content.label = option.label; hasLocalized = true; }
  if (isLocalized(option.plainDescription)) { content.plainDescription = option.plainDescription; hasLocalized = true; }
  const pc = optionProsCons(option);
  if (isLocalized(pc.prosPartyA)) { content.prosPartyA = pc.prosPartyA; hasLocalized = true; }
  if (isLocalized(pc.consPartyA)) { content.consPartyA = pc.consPartyA; hasLocalized = true; }
  if (isLocalized(pc.prosPartyB)) { content.prosPartyB = pc.prosPartyB; hasLocalized = true; }
  if (isLocalized(pc.consPartyB)) { content.consPartyB = pc.consPartyB; hasLocalized = true; }
  if (isLocalized(option.legalText)) { content.legalText = option.legalText; hasLocalized = true; }

  return hasLocalized ? content : undefined;
}

// Infer supported jurisdictions from jurisdictionConfig across all clause options
export function inferJurisdictionsFromClauses(data: SkillClauses): string[] {
  const jurisdictions = new Set<string>();
  for (const clause of data.clauses) {
    for (const option of clause.options) {
      if (option.jurisdictionConfig) {
        for (const key of Object.keys(option.jurisdictionConfig)) {
          jurisdictions.add(key);
        }
      }
    }
  }
  return jurisdictions.size > 0 ? Array.from(jurisdictions) : [];
}

// Infer supported languages from first clause option's label
export function inferLanguagesFromClauses(data: SkillClauses): string[] {
  for (const clause of data.clauses) {
    for (const option of clause.options) {
      if (isLocalized(option.label)) {
        return Object.keys(option.label as Record<string, string>);
      }
    }
  }
  return ["en"];
}

// Skill packages the seed marks premium (isPremium, the STRIPE_PRICE_ID
// environment value or null, 900, eur) on every run, when present.
export const PREMIUM_SKILL_IDS = [
  "com.nel.skills.founders",
  "com.nel.skills.safe",
  "com.nel.skills.pacto-socios",
  "com.nel.skills.employment",
  "com.nel.skills.consulting",
  "com.nel.skills.shareholders",
  "com.nel.skills.convertible-note",
  "com.nel.skills.ip-assignment",
  "com.nel.skills.term-sheet",
  "com.nel.skills.contrato-laboral",
  "com.nel.skills.contrato-servicios",
  "com.nel.skills.cesion-pi",
  "com.nel.skills.acta-junta",
  "com.nel.skills.acta-consejo",
  "com.nel.skills.phantom-shares-plan",
  "com.nel.skills.phantom-shares-grant",
  "com.nel.skills.advertising-io",
  "com.nel.skills.affiliate-program",
  "com.nel.skills.data-licensing",
  "com.nel.skills.influencer-marketing",
  "com.nel.skills.seed-investment",
  "com.nel.skills.white-label-reseller",
  "com.nel.skills.advisory",
  "com.nel.skills.technology-license",
  "com.nel.skills.joint-venture",
  "com.nel.skills.software-development",
  "com.nel.skills.equity-incentive",
  "com.nel.skills.baa-negotiator",
];

// A2A contract skills — bundled under the A2A subscription
export const A2A_SKILL_IDS = [
  "com.todolaw.skills.a2a.api-access",
  "com.todolaw.skills.a2a.tool-license",
  "com.todolaw.skills.a2a.data-sharing",
  "com.todolaw.skills.a2a.compute-procurement",
  "com.todolaw.skills.a2a.task-delegation",
  "com.todolaw.skills.a2a.content-license",
  "com.todolaw.skills.a2a.marketplace",
  "com.todolaw.skills.a2a.orchestration",
  "com.todolaw.skills.a2a.payment-authorization",
  "com.todolaw.skills.a2a.knowledge-access",
  "com.todolaw.skills.a2a.supply-chain",
  "com.todolaw.skills.a2a.monitoring",
];
