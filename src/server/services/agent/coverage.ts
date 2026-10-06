// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Startup coverage, first round (owner's decisions T3 and T4, 6 October
 * 2026): the services behind find_template, explain_options and
 * list_obligations. All three read what Dealroom already holds (the guide
 * list, the template's own option texts, the deal's agreed terms); none
 * calls an AI model, spends a credit or gives an opinion.
 */

import type { ExtendedPrismaClient } from "@/lib/prisma";
import { rankedContractPages, abs } from "@/lib/agent-discovery";
import { contractPath, type PageLocale } from "@/lib/contract-pages-paths";
import { loadContractPage } from "@/lib/contract-pages";
import { findTemplates, type FindableContract } from "@/lib/find-template";
import { buildContractDates, buildObligationsLedger } from "@/lib/obligations";
import { LIVE_ROWS } from "@/lib/clause-retirement";
import { resolveLocalizedArray, resolveLocalizedString } from "@/server/services/skills/i18n";
import { isPlaceholderContractType } from "./contractTypes";

// ---------------------------------------------------------------------------
// find_template

/** Every contract type with a guide, the common ones first, named in both languages. */
export function findableContracts(locale: PageLocale): FindableContract[] {
  return rankedContractPages().map((p) => {
    const en = loadContractPage(p.slug, "en");
    const es = loadContractPage(p.slug, "es");
    const names = [en?.heading, es?.heading].filter((n): n is string => !!n);
    const own = locale === "es" ? es ?? en : en ?? es;
    return { contractType: p.contractType, slug: p.slug, names, title: own?.heading || p.contractType };
  });
}

export function findTemplateAnswer(query: string, locale: PageLocale) {
  const result = findTemplates(query, findableContracts(locale), locale);
  return {
    query,
    matches: result.matches.map((m) => ({
      contractType: m.contractType,
      title: m.title,
      guide: abs(contractPath(locale, m.slug)),
      agentExample: `${abs(contractPath(locale, m.slug))}#agent`,
      matched: m.matched,
    })),
    outsideTemplates: result.timeSensitive,
    notYetCovered: result.notYetCovered,
    message: result.message,
  };
}

// ---------------------------------------------------------------------------
// explain_options

/** The wording of the answer (for the owner's approval: every sentence is here). */
export const EXPLAIN_TEXT = {
  neutral: {
    en: "Each option's description and its pros and cons for each side come from the template. Dealroom does not say which option to choose.",
    es: "La descripción de cada opción y sus ventajas e inconvenientes para cada parte proceden de la plantilla. Dealroom no indica qué opción elegir.",
  },
  noText: {
    en: "This clause has no explanation text in the template.",
    es: "Esta cláusula no tiene texto explicativo en la plantilla.",
  },
  optionNoText: {
    en: "The template gives no pros and cons for this option.",
    es: "La plantilla no recoge ventajas ni inconvenientes de esta opción.",
  },
  sideA: { en: "Party A", es: "Parte A" },
  sideB: { en: "Party B", es: "Parte B" },
} as const;

export type ExplainOptionsResult =
  | { ok: true; body: Record<string, unknown>; premiumSkillId: string | null }
  | { ok: false; status: 404; error: string; clauses?: { clauseId: string; title: string }[] };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function local(content: unknown, key: string, fallback: string, lang: string): string {
  const v = content && typeof content === "object" ? (content as Record<string, unknown>)[key] : undefined;
  return v !== undefined ? resolveLocalizedString(v, lang) || fallback : fallback;
}

function localList(content: unknown, key: string, fallback: string[], lang: string): string[] {
  const v = content && typeof content === "object" ? (content as Record<string, unknown>)[key] : undefined;
  return v !== undefined ? resolveLocalizedArray(v, lang) : fallback;
}

export async function explainOptions(
  db: ExtendedPrismaClient,
  input: { contractType: string; clause: string; lang: PageLocale },
): Promise<ExplainOptionsResult> {
  const { lang } = input;
  const template = isPlaceholderContractType(input.contractType)
    ? null
    : await db.contractTemplate.findUnique({
        where: { contractType: input.contractType },
        include: {
          skillPackage: true,
          clauses: {
            where: LIVE_ROWS,
            orderBy: { order: "asc" },
            include: { options: { where: LIVE_ROWS, orderBy: { order: "asc" } } },
          },
        },
      });
  if (!template || !template.isActive) return { ok: false, status: 404, error: "Template not found" };

  const wanted = norm(input.clause);
  const clause =
    template.clauses.find((c) => c.clauseId === input.clause) ??
    template.clauses.find((c) => norm(c.clauseId) === wanted) ??
    template.clauses.find((c) => norm(c.title) === wanted || norm(local(c.localizedContent, "title", c.title, lang)) === wanted);
  if (!clause) {
    return {
      ok: false,
      status: 404,
      error: "Clause not found in this template",
      clauses: template.clauses.map((c) => ({ clauseId: c.clauseId, title: local(c.localizedContent, "title", c.title, lang) })),
    };
  }

  const bp = (template.boilerplate ?? {}) as { partyLabels?: { partyA?: unknown; partyB?: unknown } };
  const sideA = resolveLocalizedString(bp.partyLabels?.partyA, lang) || EXPLAIN_TEXT.sideA[lang];
  const sideB = resolveLocalizedString(bp.partyLabels?.partyB, lang) || EXPLAIN_TEXT.sideB[lang];

  const tradeOffs = local(clause.localizedContent, "legalContext", clause.legalContext ?? "", lang).trim() || null;
  const options = clause.options.map((o) => {
    const c = o.localizedContent;
    const partyA = { pros: localList(c, "prosPartyA", o.prosPartyA, lang), cons: localList(c, "consPartyA", o.consPartyA, lang) };
    const partyB = { pros: localList(c, "prosPartyB", o.prosPartyB, lang), cons: localList(c, "consPartyB", o.consPartyB, lang) };
    const hasProsCons = [partyA.pros, partyA.cons, partyB.pros, partyB.cons].some((l) => l.length > 0);
    return {
      code: o.code,
      label: local(c, "label", o.label, lang),
      description: local(c, "plainDescription", o.plainDescription, lang).trim() || null,
      partyA,
      partyB,
      ...(hasProsCons ? {} : { note: EXPLAIN_TEXT.optionNoText[lang] }),
    };
  });
  const anyText = !!tradeOffs || options.some((o) => o.description || !("note" in o));

  return {
    ok: true,
    body: {
      contractType: template.contractType,
      clauseId: clause.clauseId,
      title: local(clause.localizedContent, "title", clause.title, lang),
      question: local(clause.localizedContent, "plainDescription", clause.plainDescription, lang).trim() || null,
      tradeOffs,
      sides: { partyA: sideA, partyB: sideB },
      options,
      note: anyText ? EXPLAIN_TEXT.neutral[lang] : EXPLAIN_TEXT.noText[lang],
    },
    premiumSkillId: template.skillPackageId && template.skillPackage ? template.skillPackage.skillId : null,
  };
}

// ---------------------------------------------------------------------------
// list_obligations

export const OBLIGATIONS_TEXT = {
  note: {
    en: "Taken from the agreed clauses and the inputs of the contract; the contract text governs. Public statutory dates are in get_deadlines.",
    es: "Tomado de las cláusulas acordadas y los datos del contrato; prevalece el texto del contrato. Las fechas legales públicas están en get_deadlines.",
  },
} as const;

export async function dealObligations(db: ExtendedPrismaClient, dealRoomId: string, lang: PageLocale) {
  const deal = await db.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: {
      contractTemplate: { select: { contractType: true, parameterSchema: true } },
      clauses: {
        include: {
          clauseTemplate: {
            select: { clauseId: true, title: true, localizedContent: true, options: { select: { id: true, code: true, label: true, localizedContent: true } } },
          },
        },
      },
    },
  });
  if (!deal) return null;

  const agreed = deal.clauses
    .filter((c) => c.status === "AGREED" && c.agreedOptionId)
    .map((c) => {
      const option = c.clauseTemplate.options.find((o) => o.id === c.agreedOptionId);
      return {
        clauseId: c.clauseTemplate.clauseId,
        code: option?.code ?? "",
        title: local(c.clauseTemplate.localizedContent, "title", c.clauseTemplate.title, lang),
        optionLabel: option ? local(option.localizedContent, "label", option.label, lang) : "",
      };
    })
    .filter((a) => a.code);

  const parameters = (deal.parameters ?? null) as Record<string, string> | null;
  const schema = deal.contractTemplate?.parameterSchema as { parameters?: { id: string; type: string; label: unknown }[] } | null;

  return {
    contractType: deal.contractTemplate?.contractType ?? null,
    status: deal.status,
    obligations: buildObligationsLedger({
      contractType: deal.contractTemplate?.contractType,
      parameters,
      agreed: agreed.map(({ clauseId, code }) => ({ clauseId, code })),
      lang,
    }),
    contractDates: buildContractDates({
      parameterSchema: schema?.parameters ?? null,
      parameters,
      agreedClauses: agreed,
      lang,
    }),
    note: OBLIGATIONS_TEXT.note[lang],
  };
}
