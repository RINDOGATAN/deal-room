/**
 * Skills Services Index
 *
 * Re-exports all skill package functionality.
 */

export {
  validateClausesFile,
  loadBoilerplateFromDirectory,
  loadSkillFromDirectory,
  scanSkillsDirectory,
  scanInstalledSkillsDirectory,
  syncSkillsToDatabase,
  getRawSkillContent,
  type ClausesFile,
  type SkillMetadata,
  type Boilerplate,
} from "./loader";

export {
  SkillPackageValidator,
  defaultValidator,
  ManifestSchema,
  ClausesFileSchema,
  BoilerplateSchema,
  type ValidationResult,
  type ValidationError,
} from "./validator";

export {
  SkillPackageInstaller,
  defaultInstaller,
} from "./installer";

export {
  resolveLocalizedString,
  resolveLocalizedArray,
  hasLanguage,
  getAvailableLanguages,
  resolveClause,
  resolveClauseOption,
  resolveJurisdictionConfig,
  resolveForParty,
  getLanguageName,
  SUPPORTED_LANGUAGES,
  LANGUAGE_FALLBACKS,
  LANGUAGE_NAMES,
  type LocalizedString,
  type LocalizedStringArray,
  type SupportedLanguage,
  type ResolvedClause,
  type ResolvedClauseOption,
  type NegotiationLanguageContext,
} from "./i18n";
