// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One matcher for every place that searches contract types: the new-deal
 * wizard, the marketplace and the agent template listing (REST and MCP).
 *
 * A query matches a contract type through, from strongest to weakest:
 * 1. its code (`NDA`, `DPA`, `PRIVACY_NOTICE`), an alias from the table
 *    below, or the acronym of a display name ("Data Processing Agreement"
 *    → `dpa`), equal to the whole query;
 * 2. an alias, the code or the template family whose words start with the
 *    query's words;
 * 3. a display name (any language) whose words start with the query's words;
 * 4. the category;
 * 5. the description.
 * Matching ignores case and accents, and every query word must be the start
 * of a word in the same field ("conf" finds "confidentiality", "dential"
 * does not).
 */

/** What the matcher reads from one contract type (or one family of them). */
export interface SearchableContract {
  /** Contract type codes (a family carries several). */
  codes: string[];
  /** Template families (`EMPLOYMENT`, `IP_ASSIGNMENT`), if any. */
  families?: (string | null | undefined)[];
  /** Display names in every language available. */
  names: (string | null | undefined)[];
  descriptions?: (string | null | undefined)[];
  categories?: (string | null | undefined)[];
}

/**
 * Abbreviations and synonyms people type, in English and Castilian
 * Spanish, keyed by contract type code or template family. A key that is
 * a family applies to every contract type of that family.
 */
export const CONTRACT_ALIASES: Record<string, readonly string[]> = {
  NDA: [
    "nda", "mnda", "mutual nda", "one way nda", "unilateral nda", "non disclosure",
    "confidentiality agreement", "confidentiality", "secrecy agreement",
    "acuerdo de confidencialidad", "contrato de confidencialidad", "confidencialidad",
    "acuerdo de no divulgacion",
  ],
  DPA: [
    "dpa", "data processing agreement", "data processing addendum", "data protection agreement",
    "art 28", "article 28", "gdpr", "rgpd", "processor agreement", "controller processor",
    "sccs", "standard contractual clauses", "tia", "transfer impact assessment",
    "encargo del tratamiento", "encargado del tratamiento", "contrato de encargo",
    "acuerdo de tratamiento de datos", "articulo 28", "clausulas contractuales tipo",
    "evaluacion de impacto de transferencia",
  ],
  MSA: [
    "msa", "master services", "master services agreement", "master agreement",
    "framework agreement", "sow", "statement of work", "services agreement",
    "contrato marco", "acuerdo marco", "prestacion de servicios",
  ],
  SAAS: [
    "saas", "software as a service", "subscription", "subscription agreement",
    "cloud services", "software subscription", "terms of service",
    "suscripcion", "contrato saas", "software como servicio",
  ],
  BAA_NEGOTIATOR: [
    "baa", "hipaa", "business associate", "business associate agreement", "phi",
    "protected health information", "hipaa baa",
  ],
  PRIVACY_NOTICE: [
    "privacy notice", "privacy policy", "gdpr notice", "data protection notice",
    "aviso de privacidad", "politica de privacidad", "clausula informativa",
    "informacion sobre proteccion de datos",
  ],
  DELAWARE_CERT_OF_INCORPORATION: [
    "incorporation", "certificate of incorporation", "delaware", "c corp", "c-corp",
    "articles of incorporation", "incorporate", "company formation",
    "constitucion", "constitucion de sociedad", "escritura de constitucion",
  ],
  CONSULTING: [
    "consulting", "consultant", "contractor", "independent contractor", "freelancer",
    "freelance", "1099", "ir35", "consultoria", "consultor", "autonomo", "freelance contrato",
  ],
  CONTRATO_SERVICIOS: [
    "service agreement", "services agreement", "prestacion de servicios",
    "contrato de servicios", "contractor", "freelancer", "autonomo",
  ],
  EMPLOYMENT: [
    "employment", "employment agreement", "employment contract", "employee", "hiring",
    "offer letter", "contrato de trabajo", "contrato laboral", "empleado", "trabajador",
  ],
  IP_ASSIGNMENT: [
    "ip assignment", "ip", "intellectual property", "intellectual property assignment",
    "invention assignment", "piia", "copyright assignment",
    "cesion de propiedad intelectual", "cesion de pi", "propiedad intelectual",
    "propiedad industrial", "cesion de derechos",
  ],
  CONVERTIBLE_NOTE: [
    "convertible", "convertible note", "convertible loan", "safe", "bridge loan",
    "prestamo convertible", "nota convertible", "deuda convertible",
  ],
  SAFE: ["safe", "simple agreement for future equity", "convertible"],
  TERM_SHEET: [
    "term sheet", "termsheet", "loi", "letter of intent", "heads of terms",
    "carta de intenciones", "hoja de terminos",
  ],
  SEED_INVESTMENT: [
    "seed", "seed round", "investment agreement", "subscription agreement",
    "pacto de inversion", "ronda semilla", "acuerdo de inversion", "inversion",
  ],
  FOUNDERS: [
    "founders", "founder agreement", "co founder", "cofounder", "vesting",
    "acuerdo de fundadores", "pacto de fundadores", "cofundador", "socios fundadores",
  ],
  SHAREHOLDERS: [
    "shareholders", "shareholder agreement", "sha", "stockholders agreement",
    "pacto de accionistas", "accionistas",
  ],
  PACTO_SOCIOS: [
    "shareholders agreement", "sha", "pacto de socios", "pacto parasocial", "socios",
    "sociedad limitada", "sl",
  ],
  EQUITY_INCENTIVE: [
    "equity incentive", "stock option", "stock options", "esop", "option plan",
    "employee equity", "plan de incentivos", "stock options plan", "opciones sobre acciones",
  ],
  PHANTOM_SHARES_PLAN: [
    "phantom shares", "phantom equity", "phantom stock", "acciones fantasma",
    "participaciones fantasma", "plan de incentivos",
  ],
  PHANTOM_SHARES_GRANT: [
    "phantom shares", "phantom grant", "phantom equity", "acciones fantasma",
    "participaciones fantasma", "asignacion",
  ],
  ADVISORY: [
    "advisory", "advisor", "adviser", "advisor agreement", "board advisor",
    "asesoramiento", "asesor", "contrato de asesor",
  ],
  JOINT_VENTURE: [
    "joint venture", "jv", "partnership", "collaboration agreement",
    "empresa conjunta", "acuerdo de colaboracion", "ute",
  ],
  ADVERTISING_IO: [
    "insertion order", "io", "advertising", "ad buy", "media buy", "ads",
    "orden de insercion", "publicidad", "campana publicitaria",
  ],
  AFFILIATE_PROGRAM: [
    "affiliate", "referral", "affiliate program", "referral agreement", "commission",
    "afiliados", "referidos", "programa de afiliados", "comision",
  ],
  INFLUENCER_MARKETING: [
    "influencer", "creator", "brand ambassador", "sponsorship", "sponsored content",
    "influencers", "creador de contenido", "embajador de marca", "patrocinio",
  ],
  WHITE_LABEL_RESELLER: [
    "white label", "reseller", "resale", "distribution", "distributor", "var",
    "marca blanca", "distribucion", "distribuidor", "revendedor", "reventa",
  ],
  DATA_LICENSING: [
    "data licensing", "data license", "data licence", "dataset", "data sharing",
    "data access", "licencia de datos", "cesion de datos", "conjunto de datos",
  ],
  TECHNOLOGY_LICENSE: [
    "technology license", "technology licence", "software license", "software licence",
    "licensing", "eula", "licencia de tecnologia", "licencia de software",
  ],
  SOFTWARE_DEVELOPMENT: [
    "software development", "development agreement", "app development", "custom software",
    "desarrollo de software", "contrato de desarrollo", "desarrollo de aplicaciones",
  ],
  ACTA_CONSEJO_ADMINISTRACION: [
    "board minutes", "minutes", "board meeting", "board resolution",
    "acta", "acta del consejo", "consejo de administracion", "acuerdos del consejo",
  ],
  ACTA_JUNTA_GENERAL: [
    "general meeting minutes", "minutes", "shareholders meeting", "agm",
    "acta", "acta de junta", "junta general", "junta de socios",
  ],
  RESIDENTIAL_TENANCY: [
    "lease", "tenancy", "rental agreement", "residential lease", "landlord", "tenant",
    "alquiler", "arrendamiento", "contrato de alquiler", "arrendamiento de vivienda",
    "inquilino", "arrendador",
  ],
  RESIDENTIAL_TENANCY_GB: ["assured periodic tenancy", "ast", "assured shorthold", "renters rights"],
  RESIDENTIAL_TENANCY_US_CA: ["california lease", "california rental agreement"],
  RESIDENTIAL_TENANCY_ES: ["lau", "ley de arrendamientos urbanos", "alquiler de vivienda"],
};

/** Lowercase, accents removed, anything but letters and digits as a space. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value: string | null | undefined): string[] {
  const normal = normalizeSearchText(value);
  return normal ? normal.split(" ") : [];
}

const ACRONYM_SKIP = new Set(["of", "the", "and", "for", "de", "del", "la", "el", "y", "e", "los", "las"]);

/**
 * The acronym of a display name: the first letter of each word, skipping
 * small joining words and anything in brackets ("Non-Disclosure Agreement"
 * → "nda", "Acuerdo de Confidencialidad" → "ac"). Null below two letters.
 */
export function acronymOf(name: string | null | undefined): string | null {
  const head = (name ?? "").replace(/\(.*?\)/g, " ");
  const letters = words(head)
    .filter((w) => !ACRONYM_SKIP.has(w) && /^[a-z]/.test(w))
    .map((w) => w[0])
    .join("");
  return letters.length >= 2 ? letters : null;
}

/** Every query word starts some word of the field. */
function prefixMatch(queryWords: string[], fieldWords: string[]): boolean {
  return queryWords.every((q) => fieldWords.some((w) => w.startsWith(q)));
}

const present = (values: (string | null | undefined)[] | undefined): string[] =>
  (values ?? []).filter((v): v is string => typeof v === "string" && v.trim().length > 0);

/** The aliases of a contract (its codes and families). */
export function aliasesFor(item: Pick<SearchableContract, "codes" | "families">): string[] {
  const keys = [...item.codes, ...present(item.families)];
  return keys.flatMap((key) => CONTRACT_ALIASES[key] ?? []);
}

/** Rank tiers, highest first. */
export const SCORE = {
  EXACT: 100,
  ALIAS: 80,
  NAME: 60,
  CATEGORY: 40,
  DESCRIPTION: 20,
} as const;

/** How well the query matches the contract: 0 is no match, higher ranks first. */
export function scoreContract(query: string, item: SearchableContract): number {
  const queryWords = words(query);
  if (queryWords.length === 0) return 0;
  const whole = queryWords.join(" ");

  const names = present(item.names);
  const codePhrases = [...item.codes, ...present(item.families)].map(normalizeSearchText);
  const aliasPhrases = aliasesFor(item).map(normalizeSearchText);
  const acronyms = names.map(acronymOf).filter((a): a is string => !!a);

  // 1. The whole query is the code, an alias or a name's acronym. The code
  // also counts written as one word ("privacynotice"), and a name equal to
  // the query is just as exact.
  const exact = new Set([
    ...codePhrases,
    ...codePhrases.map((c) => c.replace(/ /g, "")),
    ...aliasPhrases,
    ...acronyms,
    ...names.map(normalizeSearchText),
  ]);
  if (exact.has(whole)) return SCORE.EXACT;

  // 2. Alias or code words start with the query words.
  if ([...codePhrases, ...aliasPhrases].some((p) => prefixMatch(queryWords, p.split(" ")))) {
    return SCORE.ALIAS;
  }

  // 3. A display name.
  if (names.some((n) => prefixMatch(queryWords, words(n)))) return SCORE.NAME;

  // 4. Category.
  if (present(item.categories).some((c) => prefixMatch(queryWords, words(c)))) {
    return SCORE.CATEGORY;
  }

  // 5. Description.
  if (present(item.descriptions).some((d) => prefixMatch(queryWords, words(d)))) {
    return SCORE.DESCRIPTION;
  }

  return 0;
}

/**
 * The items that match the query, best first (ties keep their order). An
 * empty query returns every item unchanged.
 */
export function searchContracts<T>(
  query: string | null | undefined,
  items: readonly T[],
  toSearchable: (item: T) => SearchableContract,
): T[] {
  if (!query || words(query).length === 0) return [...items];
  return items
    .map((item, index) => ({ item, index, score: scoreContract(query, toSearchable(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}

/** The values of a localized JSON column (`{ en, es }`), else nothing. */
export function localizedValues(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).filter(
    (v): v is string => typeof v === "string",
  );
}
