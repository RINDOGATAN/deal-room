/**
 * Internationalization (i18n) Service for Skills
 *
 * Handles multilingual content resolution for skill packages.
 * Supports the i18n-within-same-skill strategy for cross-language negotiation.
 *
 * Content format:
 * - Simple string: "Hello" (legacy, default language)
 * - Localized object: { "en": "Hello", "es": "Hola" }
 */

// Supported languages
export const SUPPORTED_LANGUAGES = ["en", "es", "de", "fr", "pt"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Default language fallback chain
export const LANGUAGE_FALLBACKS: Record<SupportedLanguage, SupportedLanguage[]> = {
  en: [],
  es: ["en"],
  de: ["en"],
  fr: ["en"],
  pt: ["es", "en"],
};

// Type for localized strings
export type LocalizedString = string | Record<string, string>;
export type LocalizedStringArray = string[] | Record<string, string[]>;

/**
 * Resolve a localized string to a specific language.
 * Falls back to default language or first available if requested language not found.
 */
export function resolveLocalizedString(
  value: LocalizedString | unknown,
  language: string,
  defaultLanguage: string = "en"
): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return "";
  }

  // Simple string - return as-is
  if (typeof value === "string") {
    return value;
  }

  // Localized object
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, string>;

    // Try requested language first
    if (obj[language]) {
      return obj[language];
    }

    // Try fallback chain
    const fallbacks = LANGUAGE_FALLBACKS[language as SupportedLanguage] || [];
    for (const fallback of fallbacks) {
      if (obj[fallback]) {
        return obj[fallback];
      }
    }

    // Try default language
    if (obj[defaultLanguage]) {
      return obj[defaultLanguage];
    }

    // Return first available
    const keys = Object.keys(obj);
    if (keys.length > 0) {
      return obj[keys[0]];
    }
  }

  // Unknown type - convert to string
  return String(value);
}

/**
 * Resolve a localized string array to a specific language.
 */
export function resolveLocalizedArray(
  value: LocalizedStringArray | unknown,
  language: string,
  defaultLanguage: string = "en"
): string[] {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return [];
  }

  // Simple array - return as-is
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }

  // Localized object with arrays
  if (typeof value === "object") {
    const obj = value as Record<string, string[]>;

    // Try requested language first
    if (obj[language]) {
      return obj[language];
    }

    // Try fallback chain
    const fallbacks = LANGUAGE_FALLBACKS[language as SupportedLanguage] || [];
    for (const fallback of fallbacks) {
      if (obj[fallback]) {
        return obj[fallback];
      }
    }

    // Try default language
    if (obj[defaultLanguage]) {
      return obj[defaultLanguage];
    }

    // Return first available
    const keys = Object.keys(obj);
    if (keys.length > 0) {
      return obj[keys[0]];
    }
  }

  return [];
}

/**
 * Check if a value has localization for a specific language.
 */
export function hasLanguage(value: LocalizedString | unknown, language: string): boolean {
  if (typeof value === "string") {
    return true; // Simple strings are considered available in all languages
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return language in (value as Record<string, unknown>);
  }

  return false;
}

/**
 * Get all available languages for a localized value.
 */
export function getAvailableLanguages(value: LocalizedString | unknown): string[] {
  if (typeof value === "string") {
    return ["en"]; // Simple strings assumed to be English
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>);
  }

  return [];
}

/**
 * Resolve all localized content in a clause to a specific language.
 */
export interface ResolvedClause {
  id: string;
  title: string;
  category: string;
  order: number;
  plainDescription: string;
  isRequired: boolean;
  legalContext?: string;
  options: ResolvedClauseOption[];
}

export interface ResolvedClauseOption {
  id: string;
  code: string;
  label: string;
  order: number;
  plainDescription: string;
  prosPartyA: string[];
  consPartyA: string[];
  prosPartyB: string[];
  consPartyB: string[];
  legalText: string;
  biasPartyA: number;
  biasPartyB: number;
  jurisdictionConfig?: Record<string, unknown>;
}

export function resolveClause(
  clause: Record<string, unknown>,
  language: string
): ResolvedClause {
  const options = (clause.options as Array<Record<string, unknown>>) || [];

  return {
    id: clause.id as string,
    title: resolveLocalizedString(clause.title, language),
    category: clause.category as string,
    order: clause.order as number,
    plainDescription: resolveLocalizedString(clause.plainDescription, language),
    isRequired: (clause.isRequired as boolean) ?? true,
    legalContext: clause.legalContext
      ? resolveLocalizedString(clause.legalContext, language)
      : undefined,
    options: options.map((option) => resolveClauseOption(option, language)),
  };
}

export function resolveClauseOption(
  option: Record<string, unknown>,
  language: string
): ResolvedClauseOption {
  const pros = option.pros as Record<string, unknown> | undefined;
  const cons = option.cons as Record<string, unknown> | undefined;
  const bias = option.bias as Record<string, number> | undefined;

  return {
    id: option.id as string,
    code: option.code as string,
    label: resolveLocalizedString(option.label, language),
    order: option.order as number,
    plainDescription: resolveLocalizedString(option.plainDescription, language),
    prosPartyA: resolveLocalizedArray(pros?.partyA, language),
    consPartyA: resolveLocalizedArray(cons?.partyA, language),
    prosPartyB: resolveLocalizedArray(pros?.partyB, language),
    consPartyB: resolveLocalizedArray(cons?.partyB, language),
    legalText: resolveLocalizedString(option.legalText, language),
    biasPartyA: bias?.partyA ?? 0,
    biasPartyB: bias?.partyB ?? 0,
    jurisdictionConfig: option.jurisdictionConfig as Record<string, unknown> | undefined,
  };
}

/**
 * Resolve jurisdiction-specific warnings and alternate text.
 */
export function resolveJurisdictionConfig(
  config: Record<string, unknown> | undefined,
  jurisdiction: string,
  language: string
): { available: boolean; warning?: string; alternativeText?: string } {
  if (!config || !config[jurisdiction]) {
    return { available: true };
  }

  const jurisdictionConfig = config[jurisdiction] as Record<string, unknown>;

  return {
    available: (jurisdictionConfig.available as boolean) ?? true,
    warning: jurisdictionConfig.warning
      ? resolveLocalizedString(jurisdictionConfig.warning, language)
      : undefined,
    alternativeText: jurisdictionConfig.alternativeText
      ? resolveLocalizedString(jurisdictionConfig.alternativeText, language)
      : undefined,
  };
}

/**
 * Context for multi-party negotiation with different languages.
 * Each party can have their preferred language for viewing content.
 */
export interface NegotiationLanguageContext {
  partyALanguage: string;
  partyBLanguage: string;
  documentLanguage: string; // Language for the final generated document
}

/**
 * Resolve content for a specific party in a negotiation.
 */
export function resolveForParty(
  content: Record<string, unknown>,
  context: NegotiationLanguageContext,
  party: "A" | "B"
): Record<string, unknown> {
  const language = party === "A" ? context.partyALanguage : context.partyBLanguage;

  // Deep resolve all localized strings
  return deepResolveLocalized(content, language);
}

/**
 * Deep resolve all localized content in an object.
 */
function deepResolveLocalized(
  obj: unknown,
  language: string
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return {};
  }

  // Check if it's a localized string (object with language keys)
  if (typeof obj === "object" && !Array.isArray(obj)) {
    const keys = Object.keys(obj as object);
    const isLocalized = keys.every(
      (k) => k.length === 2 && typeof (obj as Record<string, unknown>)[k] === "string"
    );

    if (isLocalized && keys.length > 0) {
      return { value: resolveLocalizedString(obj as LocalizedString, language) };
    }

    // Not a localized string - recurse into object
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const resolved = deepResolveLocalized((obj as Record<string, unknown>)[key], language);
      result[key] = resolved.value !== undefined ? resolved.value : resolved;
    }
    return result;
  }

  // Array - resolve each element
  if (Array.isArray(obj)) {
    return { value: obj.map((item) => {
      const resolved = deepResolveLocalized(item, language);
      return resolved.value !== undefined ? resolved.value : resolved;
    }) };
  }

  // Primitive - return as-is wrapped
  return { value: obj };
}

/**
 * Language display names for UI.
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, Record<SupportedLanguage, string>> = {
  en: {
    en: "English",
    es: "Spanish",
    de: "German",
    fr: "French",
    pt: "Portuguese",
  },
  es: {
    en: "Inglés",
    es: "Español",
    de: "Alemán",
    fr: "Francés",
    pt: "Portugués",
  },
  de: {
    en: "Englisch",
    es: "Spanisch",
    de: "Deutsch",
    fr: "Französisch",
    pt: "Portugiesisch",
  },
  fr: {
    en: "Anglais",
    es: "Espagnol",
    de: "Allemand",
    fr: "Français",
    pt: "Portugais",
  },
  pt: {
    en: "Inglês",
    es: "Espanhol",
    de: "Alemão",
    fr: "Francês",
    pt: "Português",
  },
};

/**
 * Get language name in a specific display language.
 */
export function getLanguageName(
  languageCode: string,
  displayLanguage: string = "en"
): string {
  const names = LANGUAGE_NAMES[displayLanguage as SupportedLanguage] || LANGUAGE_NAMES.en;
  return names[languageCode as SupportedLanguage] || languageCode;
}
