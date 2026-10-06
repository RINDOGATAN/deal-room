// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * find_template: the agent describes a matter in its own words and gets
 * back the contract templates that match, or the plain answer that no
 * template covers it (owner's decision T3, 6 October 2026).
 *
 * Deterministic: the words of the description are matched with the same
 * matcher as every other contract search (`contract-search.ts`); no AI
 * model reads the description. Before matching, two kinds of phrase are
 * taken out of it:
 *
 * - time-sensitive matters (a lawsuit or claim received, a subpoena, a
 *   data breach, a letter from a regulator), which are outside the
 *   templates and are flagged as such;
 * - documents Dealroom has no template for yet (the gaps of T1), so that
 *   an alias such as "terms of service" does not offer the SaaS
 *   subscription in their place.
 *
 * It never says what the user needs and never names a lawyer.
 */

import {
  SCORE,
  aliasesFor,
  normalizeSearchText,
  scoreContract,
  type SearchableContract,
} from "./contract-search";
import type { PageLocale } from "./contract-pages-paths";

export type TimeSensitiveCategory = "LAWSUIT_OR_CLAIM" | "SUBPOENA" | "DATA_BREACH" | "REGULATOR_LETTER";

/** Phrases (normalized: lowercase, no accents) that flag each category. */
export const TIME_SENSITIVE_PHRASES: Record<TimeSensitiveCategory, readonly string[]> = {
  LAWSUIT_OR_CLAIM: [
    "lawsuit", "lawsuits", "sued", "suing", "being sued", "sue us", "sue me", "summons",
    "complaint filed", "claim against us", "claim against me", "demand letter",
    "cease and desist", "litigation", "legal action", "small claims",
    "demanda judicial", "demandado", "demandada", "demandados", "nos han demandado", "me han demandado",
    "reclamacion judicial", "carta de reclamacion", "burofax", "requerimiento de pago", "pleito",
  ],
  SUBPOENA: [
    "subpoena", "subpoenaed", "subpoenas", "court order", "search warrant",
    "citacion judicial", "citacion", "requerimiento judicial", "orden judicial", "emplazamiento",
  ],
  DATA_BREACH: [
    "data breach", "security breach", "personal data breach", "security incident",
    "hacked", "hack", "ransomware", "data leak", "leaked data", "cyberattack", "cyber attack",
    "brecha de datos", "brecha de seguridad", "violacion de datos", "violacion de seguridad",
    "fuga de datos", "filtracion de datos", "hackeo", "ciberataque", "incidente de seguridad",
  ],
  REGULATOR_LETTER: [
    "regulator", "regulators", "regulatory inquiry", "regulatory investigation", "investigation",
    "civil investigative demand", "attorney general", "ftc", "cppa", "ico", "aepd", "cnil",
    "inquiry letter", "letter from the regulator",
    "regulador", "autoridad de control", "inspeccion de trabajo", "expediente sancionador",
    "procedimiento sancionador", "agencia de proteccion de datos", "carta del regulador",
  ],
};

/** What each category is called in the answer. */
export const TIME_SENSITIVE_LABELS: Record<TimeSensitiveCategory, Record<PageLocale, string>> = {
  LAWSUIT_OR_CLAIM: { en: "a lawsuit or claim received", es: "una demanda o reclamación recibida" },
  SUBPOENA: { en: "a subpoena", es: "una citación o un requerimiento judicial" },
  DATA_BREACH: { en: "a data breach", es: "una brecha de datos" },
  REGULATOR_LETTER: { en: "a letter from a regulator", es: "una carta de un regulador" },
};

/**
 * Documents Dealroom has no template for yet (owner's list T1), with the
 * phrases that name them. Normalized phrases.
 */
export const NOT_YET_COVERED: readonly { name: Record<PageLocale, string>; phrases: readonly string[] }[] = [
  {
    name: { en: "Terms of Service", es: "condiciones de uso (Terms of Service)" },
    phrases: ["terms of service", "terms of use", "terms and conditions", "tos", "condiciones de uso", "terminos de uso", "terminos y condiciones", "condiciones generales"],
  },
  { name: { en: "bylaws", es: "estatutos (bylaws)" }, phrases: ["bylaws", "by laws", "estatutos"] },
  { name: { en: "board consents", es: "acuerdos escritos del consejo (board consents)" }, phrases: ["board consent", "board consents", "written consent", "unanimous written consent"] },
  {
    name: { en: "founder stock purchase with 83(b)", es: "compra de acciones de fundador con 83(b)" },
    phrases: ["83 b", "83b", "stock purchase agreement", "founder stock purchase", "restricted stock purchase"],
  },
  { name: { en: "option grants", es: "concesión de opciones (option grant)" }, phrases: ["option grant", "stock option grant", "stock option agreement", "grant notice"] },
  { name: { en: "US offer letter", es: "carta de oferta de empleo (EE. UU.)" }, phrases: ["offer letter", "carta de oferta"] },
  { name: { en: "invention assignment agreement (CIIAA)", es: "acuerdo de cesión de invenciones (CIIAA)" }, phrases: ["ciiaa", "confidential information and invention assignment"] },
  { name: { en: "order form", es: "hoja de pedido (order form)" }, phrases: ["order form", "hoja de pedido"] },
  { name: { en: "cookie policy", es: "política de cookies" }, phrases: ["cookie policy", "cookie notice", "cookies policy", "politica de cookies", "aviso de cookies"] },
  { name: { en: "acceptable use policy", es: "política de uso aceptable" }, phrases: ["acceptable use", "acceptable use policy", "aup", "politica de uso aceptable"] },
  {
    name: { en: "contract notices", es: "notificaciones contractuales" },
    phrases: ["termination notice", "notice of termination", "termination letter", "non renewal notice", "notice of non renewal", "breach notice", "notice of breach", "carta de resolucion", "notificacion de resolucion", "preaviso de no renovacion"],
  },
  { name: { en: "side letter", es: "carta paralela (side letter)" }, phrases: ["side letter", "carta paralela"] },
  { name: { en: "separation agreement", es: "acuerdo de salida (separation agreement)" }, phrases: ["separation agreement", "severance agreement", "acuerdo de salida", "finiquito"] },
  { name: { en: "LLC operating agreement", es: "acuerdo operativo de LLC" }, phrases: ["llc", "operating agreement", "llc agreement"] },
];

/**
 * Words that say nothing about which contract is meant. Alone, they never
 * select a template; inside a longer phrase they still count.
 */
const GENERIC_WORDS = new Set([
  // English
  "a", "an", "the", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "from", "our", "my",
  "we", "us", "i", "me", "you", "your", "they", "them", "their", "it", "its", "is", "are", "be", "been",
  "have", "has", "had", "need", "needs", "want", "wants", "looking", "draft", "drafting", "make", "create",
  "write", "template", "templates", "contract", "contracts", "agreement", "agreements", "document",
  "documents", "form", "help", "new", "some", "one", "two", "this", "that", "who", "what", "how", "can",
  "do", "does", "get", "got", "received", "receive", "about", "company", "startup", "business", "firm",
  "client", "clients", "customer", "customers", "app", "application", "between", "party", "parties",
  "other", "side", "please", "just", "would", "like", "should", "will", "sign", "signed", "simple",
  "standard", "basic", "based", "under", "law", "laws", "state", "us", "usa", "california", "delaware",
  "england", "wales", "uk", "spain", "spanish", "english", "work", "term", "terms", "data", "software",
  "notify", "first", "our", "own", "deal", "deals",
  // Spanish
  "un", "una", "unos", "unas", "el", "la", "los", "las", "y", "o", "de", "del", "para", "con", "en", "por",
  "nuestro", "nuestra", "nuestros", "nuestras", "mi", "mis", "nos", "nosotros", "yo", "tu", "su", "sus",
  "es", "son", "ser", "hemos", "tenemos", "necesito", "necesitamos", "quiero", "queremos", "redactar",
  "crear", "hacer", "plantilla", "plantillas", "contrato", "contratos", "acuerdo", "acuerdos", "documento",
  "documentos", "modelo", "ayuda", "nuevo", "nueva", "que", "como", "recibido", "empresa", "sociedad",
  "cliente", "clientes", "aplicacion", "entre", "parte", "partes", "otra", "otro", "firmar", "sencillo",
  "ley", "derecho", "espana", "espanol", "datos", "trabajo",
]);

/** The longest phrase tried, in words. */
const MAX_PHRASE_WORDS = 5;
/** Matches below this rank are left out (category and description matches are too loose here). */
const MIN_SCORE = SCORE.NAME;
/** At most this many templates in the answer. */
export const MAX_MATCHES = 5;

/** One contract type the tool can offer. */
export interface FindableContract {
  contractType: string;
  slug: string;
  /** Display names in every language. */
  names: string[];
  /** Name in the answer's language. */
  title: string;
}

export interface FindTemplateMatch {
  contractType: string;
  title: string;
  slug: string;
  /** The phrase of the description that matched. */
  matched: string;
}

export interface FindTemplateResult {
  matches: FindTemplateMatch[];
  timeSensitive: TimeSensitiveCategory[];
  notYetCovered: string[];
  message: string;
}

/** The wording of the answer (for the owner's approval: every sentence is here). */
export const FIND_TEMPLATE_TEXT = {
  noTemplate: {
    en: "No template covers this. Such matters are usually handled by a lawyer.",
    es: "Ninguna plantilla cubre esto. De estos asuntos suele ocuparse un abogado o una abogada.",
  },
  timeSensitive: {
    en: (labels: string) => `The description mentions ${labels}: a time-sensitive matter that is outside the templates.`,
    es: (labels: string) => `La descripción menciona ${labels}: un asunto urgente que queda fuera de las plantillas.`,
  },
  usuallyLawyer: {
    en: "Such matters are usually handled by a lawyer.",
    es: "De estos asuntos suele ocuparse un abogado o una abogada.",
  },
  notYetCovered: {
    en: (names: string) => `Dealroom has no template yet for: ${names}.`,
    es: (names: string) => `Dealroom aún no tiene plantilla para: ${names}.`,
  },
  matches: {
    en: "Templates whose names or usual terms appear in the description, closest first. The matching is by words; no AI model reads the description.",
    es: "Plantillas cuyo nombre o términos habituales aparecen en la descripción, de la más cercana a la menos. La búsqueda es por palabras; ningún modelo de IA lee la descripción.",
  },
} as const;

function joinList(items: string[], locale: PageLocale): string {
  if (items.length <= 1) return items.join("");
  const last = items[items.length - 1];
  return `${items.slice(0, -1).join(", ")} ${locale === "es" ? "y" : "and"} ${last}`;
}

/** The normalized query with every given phrase cut out; returns what was found. */
function cutPhrases(text: string, phrases: readonly string[]): { rest: string; found: boolean } {
  let rest = ` ${text} `;
  let found = false;
  // Longest first, so "personal data breach" goes before "data breach".
  for (const p of [...phrases].sort((a, b) => b.length - a.length)) {
    const needle = ` ${p} `;
    while (rest.includes(needle)) {
      rest = rest.replace(needle, " | ");
      found = true;
    }
  }
  return { rest: rest.trim(), found };
}

/** Contiguous runs of words, never across a cut-out phrase. */
function phrasesOf(rest: string): string[][] {
  return rest
    .split("|")
    .map((chunk) => chunk.trim().split(" ").filter(Boolean))
    .filter((words) => words.length > 0);
}

/** Every whole word of the codes, aliases and names of a contract. */
function wordsOf(item: SearchableContract): Set<string> {
  const phrases = [...item.codes, ...aliasesFor(item), ...item.names.filter((n): n is string => !!n)];
  return new Set(phrases.flatMap((p) => normalizeSearchText(p).split(" ")));
}

function bestMatch(runs: string[][], item: SearchableContract): { score: number; length: number; phrase: string } | null {
  let best: { score: number; length: number; phrase: string } | null = null;
  const whole = wordsOf(item);
  for (const words of runs) {
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length); n >= 1; n--) {
      for (let i = 0; i + n <= words.length; i++) {
        const window = words.slice(i, i + n);
        if (n === 1) {
          const w = window[0];
          if (GENERIC_WORDS.has(w)) continue;
        }
        if (window.every((w) => GENERIC_WORDS.has(w))) continue;
        const phrase = window.join(" ");
        let score = scoreContract(phrase, item);
        // A single word counts only as a whole word ("share" does not pick
        // "shareholders"), and a short one only as the whole code or alias.
        if (n === 1 && score < SCORE.EXACT && (window[0].length < 4 || !whole.has(window[0]))) score = 0;
        if (score < MIN_SCORE) continue;
        if (!best || score > best.score || (score === best.score && n > best.length)) {
          best = { score, length: n, phrase };
        }
      }
    }
  }
  return best;
}

/**
 * The answer of find_template. `contracts` is the list of contract types,
 * in the order to prefer on equal matches (the common contracts first).
 */
export function findTemplates(
  query: string,
  contracts: readonly FindableContract[],
  locale: PageLocale = "en",
): FindTemplateResult {
  const normal = normalizeSearchText(query);

  // 1. Time-sensitive matters.
  let rest = normal;
  const timeSensitive: TimeSensitiveCategory[] = [];
  for (const category of Object.keys(TIME_SENSITIVE_PHRASES) as TimeSensitiveCategory[]) {
    const cut = cutPhrases(rest, TIME_SENSITIVE_PHRASES[category]);
    if (cut.found) {
      timeSensitive.push(category);
      rest = cut.rest;
    }
  }

  // 2. Documents with no template yet.
  const notYetCovered: string[] = [];
  for (const gap of NOT_YET_COVERED) {
    const cut = cutPhrases(rest, gap.phrases);
    if (cut.found) {
      notYetCovered.push(gap.name[locale]);
      rest = cut.rest;
    }
  }

  // 3. What is left, matched phrase by phrase.
  const runs = phrasesOf(rest);
  const scored = contracts
    .map((c, index) => {
      const best = bestMatch(runs, { codes: [c.contractType], names: c.names });
      return best ? { c, index, ...best } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score || b.length - a.length || a.index - b.index)
    .slice(0, MAX_MATCHES);

  const matches = scored.map((r) => ({
    contractType: r.c.contractType,
    title: r.c.title,
    slug: r.c.slug,
    matched: r.phrase,
  }));

  const parts: string[] = [];
  if (timeSensitive.length > 0) {
    parts.push(FIND_TEMPLATE_TEXT.timeSensitive[locale](joinList(timeSensitive.map((c) => TIME_SENSITIVE_LABELS[c][locale]), locale)));
  }
  if (notYetCovered.length > 0) {
    parts.push(FIND_TEMPLATE_TEXT.notYetCovered[locale](notYetCovered.join(", ")));
  }
  if (matches.length === 0) {
    parts.push(FIND_TEMPLATE_TEXT.noTemplate[locale]);
  } else {
    if (timeSensitive.length > 0) parts.push(FIND_TEMPLATE_TEXT.usuallyLawyer[locale]);
    parts.push(FIND_TEMPLATE_TEXT.matches[locale]);
  }

  return { matches, timeSensitive, notYetCovered, message: parts.join(" ") };
}
