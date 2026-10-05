// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The contract types an agent can ask for, with what each one needs: the
 * governing laws and languages it is offered in, the role the caller can
 * take (asymmetric contracts only) and the inputs (deal parameters) it
 * asks for. Read from the seeded catalogue, so it always matches what the
 * one-call generation (POST /api/v1/agent/contracts) accepts.
 *
 * Agent-to-agent protocol templates (`A2A_` prefix) are left out: they are
 * negotiated through playbooks, under their own weekly limits.
 */

import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  CONTRACT_PAGES,
  SITE_URL,
  contractPath,
} from "@/lib/contract-pages-paths";
import { governingLawForSkillJurisdiction, type GoverningLaw } from "@/lib/jurisdictions";
import { resolveParamString, type ParameterSchema } from "@/lib/parameters";
import { roleConfigFor } from "@/lib/contractRoles";
import { LIVE_ROWS } from "@/lib/clause-retirement";
import { brand } from "@/config/brand";

export const A2A_PREFIX = "A2A_";

export interface ContractTypeInput {
  id: string;
  label: string;
  type: string;
  required: boolean;
  /** Only asked under these governing laws (absent: under all of them). */
  onlyUnder?: string[];
  options?: string[];
  default?: string;
  hint?: string;
}

export interface ContractTypeDescriptor {
  /** Code to send as `contractType` (the slug works too). */
  contractType: string;
  /** Address of the public guide, when there is one. */
  slug: string | null;
  name: string;
  description: string | null;
  governingLaws: GoverningLaw[];
  languages: string[];
  /** Asymmetric contracts only: the role values `role` accepts, default first. */
  roles: string[] | null;
  inputs: ContractTypeInput[];
  clauseCount: number;
  guide: { en: string; es: string } | null;
  /** Full clause and option list. */
  details: string;
}

function localized(value: unknown, fallback: string | null, lang: string): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = (value as Record<string, unknown>)[lang];
    if (typeof v === "string" && v.trim()) return v;
  }
  return fallback;
}

/** The governing-law values a template's jurisdiction tags allow, in their order, without repeats. */
export function governingLawsFor(jurisdictions: string[]): GoverningLaw[] {
  const out: GoverningLaw[] = [];
  for (const tag of jurisdictions) {
    const law = governingLawForSkillJurisdiction(tag);
    if (law && !out.includes(law)) out.push(law);
  }
  return out;
}

export function inputsFor(schema: ParameterSchema | null | undefined, lang: string): ContractTypeInput[] {
  if (!schema?.parameters?.length) return [];
  return schema.parameters.map((p) => {
    const input: ContractTypeInput = {
      id: p.id,
      label: resolveParamString(p.label, lang, p.id),
      type: p.type,
      required: !!p.required,
    };
    if (p.jurisdictions?.length) input.onlyUnder = p.jurisdictions;
    if (p.options?.length) input.options = p.options;
    if (p.default !== undefined) input.default = p.default;
    const hint = resolveParamString(p.hint, lang);
    if (hint) input.hint = hint;
    return input;
  });
}

export function slugForContractType(contractType: string): string | null {
  return CONTRACT_PAGES.find((p) => p.contractType === contractType)?.slug ?? null;
}

/**
 * The contract type code for what a caller sent: a code ("NDA"), a code in
 * any case ("nda") or a guide slug ("data-processing-agreement").
 */
export function contractTypeFromInput(value: string, knownCodes: string[]): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (knownCodes.includes(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase();
  const byCode = knownCodes.find((c) => c.toUpperCase() === upper);
  if (byCode) return byCode;
  const page = CONTRACT_PAGES.find((p) => p.slug === trimmed.toLowerCase());
  if (page && knownCodes.includes(page.contractType)) return page.contractType;
  return null;
}

export async function listContractTypes(
  prisma: ExtendedPrismaClient,
  opts: { lang?: string } = {},
): Promise<ContractTypeDescriptor[]> {
  const lang = opts.lang === "es" ? "es" : "en";
  const templates = await prisma.contractTemplate.findMany({
    where: { isActive: true, NOT: { contractType: { startsWith: A2A_PREFIX } } },
    select: {
      contractType: true,
      displayName: true,
      displayNameLocalized: true,
      description: true,
      descriptionLocalized: true,
      jurisdictions: true,
      languages: true,
      parameterSchema: true,
      _count: { select: { clauses: { where: LIVE_ROWS } } },
    },
    orderBy: { displayName: "asc" },
  });

  return templates.map((t) => {
    const slug = slugForContractType(t.contractType);
    const role = roleConfigFor(t.contractType);
    return {
      contractType: t.contractType,
      slug,
      name: localized(t.displayNameLocalized, t.displayName, lang) ?? t.displayName,
      description: localized(t.descriptionLocalized, t.description, lang),
      governingLaws: governingLawsFor(t.jurisdictions),
      languages: t.languages,
      roles: role
        ? [role.defaultRole, ...role.options.map((o) => o.role).filter((r) => r !== role.defaultRole)]
        : null,
      inputs: inputsFor(t.parameterSchema as unknown as ParameterSchema | null, lang),
      clauseCount: t._count.clauses,
      guide: slug
        ? { en: `${SITE_URL}${contractPath("en", slug)}`, es: `${SITE_URL}${contractPath("es", slug)}` }
        : null,
      details: `https://${brand.appDomain}/api/v1/agent/templates/${t.contractType}`,
    };
  });
}
