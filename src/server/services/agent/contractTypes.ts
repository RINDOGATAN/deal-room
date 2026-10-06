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
  CONTRACT_GROUPS,
  CONTRACT_PAGES,
  SITE_URL,
  contractPath,
} from "@/lib/contract-pages-paths";
import { governingLawForSkillJurisdiction, type GoverningLaw } from "@/lib/jurisdictions";
import { resolveParamString, type ParameterSchema } from "@/lib/parameters";
import { roleConfigFor } from "@/lib/contractRoles";
import { LIVE_ROWS } from "@/lib/clause-retirement";
import { brand } from "@/config/brand";
import { mustSend } from "@/lib/agent-inputs";

export const A2A_PREFIX = "A2A_";

/**
 * The seeded placeholder template (no guide, a dummy description). It is
 * not a contract: no agent-facing list shows it and no agent tool accepts
 * it, as the /deals/new skill list already does (skills router).
 */
export const PLACEHOLDER_CONTRACT_TYPE = "TEMPLATE";

/** Whether a code is the placeholder template, in any case. */
export function isPlaceholderContractType(code: string | null | undefined): boolean {
  return (code ?? "").trim().toUpperCase() === PLACEHOLDER_CONTRACT_TYPE;
}

export interface ContractTypeInput {
  id: string;
  label: string;
  type: string;
  required: boolean;
  /**
   * Required and without a default: the one call refuses the contract
   * without it. A required input with a default can be left out and the
   * default is applied.
   */
  mustSend: boolean;
  /** Only asked under these governing laws (absent: under all of them). */
  onlyUnder?: string[];
  options?: string[];
  default?: string;
  hint?: string;
}

export interface ContractTypeDescriptor {
  /** Code to send as `contractType` (the slug works too). */
  contractType: string;
  /**
   * The group it is listed under: the group of its public guide (the same
   * groups as /contracts), else the template's own category.
   */
  group: { id: string; name: string };
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
      mustSend: false,
    };
    if (p.jurisdictions?.length) input.onlyUnder = p.jurisdictions;
    if (p.options?.length) input.options = p.options;
    if (p.default !== undefined) input.default = p.default;
    const hint = resolveParamString(p.hint, lang);
    if (hint) input.hint = hint;
    input.mustSend = mustSend(input);
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

/** The list's group of a type: its guide's group, else the template category. */
export function groupFor(
  contractType: string,
  category: string | null,
  categoryLocalized: unknown,
  lang: "en" | "es",
): { id: string; name: string } {
  const page = CONTRACT_PAGES.find((p) => p.contractType === contractType);
  const group = page && CONTRACT_GROUPS.find((g) => g.id === page.group);
  if (group) return { id: group.id, name: group.name[lang] };
  const name = localized(categoryLocalized, category, lang);
  return name ? { id: `category-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name } : { id: "other", name: lang === "es" ? "Otros" : "Other" };
}

/** Group order as on /contracts, then any other group by name; names sorted within a group. */
export function sortContractTypes(list: ContractTypeDescriptor[], lang: "en" | "es"): ContractTypeDescriptor[] {
  const rank = (id: string) => {
    const i = CONTRACT_GROUPS.findIndex((g) => g.id === id);
    return i === -1 ? CONTRACT_GROUPS.length : i;
  };
  const collator = new Intl.Collator(lang, { sensitivity: "base" });
  return [...list].sort(
    (a, b) =>
      rank(a.group.id) - rank(b.group.id) ||
      collator.compare(a.group.name, b.group.name) ||
      collator.compare(a.name, b.name),
  );
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; list: ContractTypeDescriptor[] }>();

/** Test hook. */
export function resetContractTypesCache() {
  cache.clear();
}

/**
 * Every contract type the one call accepts, grouped and sorted. The single
 * source for the JSON endpoint, the /developers page and /developers.md.
 * Cached for five minutes per server instance.
 */
export async function listContractTypes(
  prisma: ExtendedPrismaClient,
  opts: { lang?: string } = {},
): Promise<ContractTypeDescriptor[]> {
  const lang = opts.lang === "es" ? "es" : "en";
  const hit = cache.get(lang);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.list;
  const list = await loadContractTypes(prisma, lang);
  cache.set(lang, { at: Date.now(), list });
  return list;
}

async function loadContractTypes(
  prisma: ExtendedPrismaClient,
  lang: "en" | "es",
): Promise<ContractTypeDescriptor[]> {
  const templates = await prisma.contractTemplate.findMany({
    where: {
      isActive: true,
      NOT: [{ contractType: { startsWith: A2A_PREFIX } }, { contractType: PLACEHOLDER_CONTRACT_TYPE }],
    },
    select: {
      contractType: true,
      displayName: true,
      displayNameLocalized: true,
      description: true,
      descriptionLocalized: true,
      jurisdictions: true,
      languages: true,
      parameterSchema: true,
      category: true,
      categoryLocalized: true,
      _count: { select: { clauses: { where: LIVE_ROWS } } },
    },
    orderBy: { displayName: "asc" },
  });

  // A template without clauses (a catalogue-only stub) cannot make a contract.
  const usable = templates.filter((t) => t._count.clauses > 0);
  const list = usable.map((t) => {
    const slug = slugForContractType(t.contractType);
    const role = roleConfigFor(t.contractType);
    return {
      contractType: t.contractType,
      group: groupFor(t.contractType, t.category, t.categoryLocalized, lang),
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
  return sortContractTypes(list, lang);
}
