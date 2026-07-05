"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatPrice } from "@/lib/currency";
import {
  FileText,
  Shield,
  Briefcase,
  Cloud,
  ArrowRight,
  Check,
  Scale,
  Globe,
  Languages,
  Lock,
  Megaphone,
  Link2,
  Users,
  Download,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParameterDefinition, ParameterSchema } from "@/lib/parameters";
import { resolveParamString } from "@/lib/parameters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getContactMailto } from "@/config/brand";
import { PromoBanner } from "@/components/PromoBanner";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";

const contractIcons: Record<string, typeof FileText> = {
  NDA: Shield,
  DPA: Shield,
  PRIVACY_NOTICE: Shield,
  MSA: Briefcase,
  SAAS: Cloud,
  FOUNDERS: Briefcase,
  PACTO_SOCIOS: Briefcase,
  SAFE: FileText,
  ADVERTISING_IO: Megaphone,
  AFFILIATE_PROGRAM: Link2,
};

import { governingLawForSkillJurisdiction } from "@/lib/jurisdictions";

type GoverningLaw = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";

// Template type from the API
interface TemplateInfo {
  id: string;
  contractType: string;
  displayName: string;
  description: string | null;
  category: string | null;
  version: string;
  clauseCount: number;
  templateFamily: string | null;
  nativeJurisdiction: string | null;
  jurisdictions: string[];
  languages: string[];
  requiresLicense: boolean;
  skillPackageId: string | null;
  soloModeSupported: boolean;
  soloModeDefault: boolean;
  soloModeOnly: boolean;
  hasAccess: boolean;
  entitledJurisdictions: string[];
  expiresAt: Date | null;
}

type DealMode = "NEGOTIATION" | "SOLO";

// Group templates by family for display
interface TemplateFamily {
  family: string;
  displayName: string;
  description: string | null;
  category: string | null;
  templates: TemplateInfo[];
  primaryTemplate: TemplateInfo;
}

function groupTemplatesByFamily(
  templates: TemplateInfo[]
): TemplateFamily[] {
  const familyMap = new Map<string, TemplateFamily>();
  const ungrouped: TemplateInfo[] = [];

  for (const t of templates) {
    if (t.templateFamily) {
      if (!familyMap.has(t.templateFamily)) {
        familyMap.set(t.templateFamily, {
          family: t.templateFamily,
          displayName: t.displayName,
          description: t.description,
          category: t.category,
          templates: [t],
          primaryTemplate: t,
        });
      } else {
        familyMap.get(t.templateFamily)!.templates.push(t);
      }
    } else {
      ungrouped.push(t);
    }
  }

  // Build result: families first, then ungrouped
  const result: TemplateFamily[] = [];
  for (const family of familyMap.values()) {
    // Use the non-native (original) template as the primary display
    const primary = family.templates.find((t) => !t.nativeJurisdiction || t.nativeJurisdiction === "CALIFORNIA") || family.templates[0];
    family.primaryTemplate = primary;
    family.displayName = primary.displayName;
    family.description = primary.description;
    family.category = primary.category;
    result.push(family);
  }

  for (const t of ungrouped) {
    result.push({
      family: t.contractType,
      displayName: t.displayName,
      description: t.description,
      category: t.category,
      templates: [t],
      primaryTemplate: t,
    });
  }

  return result;
}
type ContractLanguage = "en" | "es";

const contractLanguageMeta = [
  { value: "en" as ContractLanguage, tKey: "english" as const },
  { value: "es" as ContractLanguage, tKey: "spanish" as const },
];

const jurisdictionMeta = [
  { value: "CALIFORNIA" as GoverningLaw, flag: "🇺🇸", tKey: "california" as const },
  { value: "ENGLAND_WALES" as GoverningLaw, flag: "🇬🇧", tKey: "englandWales" as const },
  { value: "SPAIN" as GoverningLaw, flag: "🇪🇸", tKey: "spain" as const },
];

/** Controller/Processor role picker for DPAs. The initiator chooses; in SOLO
 *  the other role's block is left blank, in NEGOTIATION the counterparty takes
 *  the opposite role. */
function DpaRoleSelector({
  value,
  onChange,
  mode,
}: {
  value: "CONTROLLER" | "PROCESSOR";
  onChange: (role: "CONTROLLER" | "PROCESSOR") => void;
  mode: DealMode;
}) {
  const t = useTranslations("newDeal");
  return (
    <div className="space-y-2">
      <Label>{t("dpaRoleTitle")}</Label>
      <p className="text-xs text-muted-foreground">
        {mode === "SOLO" ? t("dpaRoleHint") : t("dpaRoleHintNegotiation")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {([
          { role: "PROCESSOR" as const, title: t("dpaRoleProcessor"), desc: t("dpaRoleProcessorDescription") },
          { role: "CONTROLLER" as const, title: t("dpaRoleController"), desc: t("dpaRoleControllerDescription") },
        ]).map(({ role, title, desc }) => (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            aria-pressed={value === role}
            className={`card-brutal text-left relative transition-colors p-4 ${
              value === role ? "border-primary" : "hover:border-muted-foreground"
            }`}
          >
            {value === role && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewDealPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("newDeal");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<GoverningLaw | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<ContractLanguage>("en");
  const [dealName, setDealName] = useState("");
  const [company, setCompany] = useState("");
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [enableModalSkill, setEnableModalSkill] = useState<{ id: string; name: string } | null>(null);
  const [resolvedNativeTemplate, setResolvedNativeTemplate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [missingParams, setMissingParams] = useState<Set<string>>(new Set());
  const [dealMode, setDealMode] = useState<DealMode>("NEGOTIATION");
  // SOLO DPA only: which role the filling party takes (Controller vs Processor).
  // Default Processor — most processors prepare the template for a controller.
  const [fillRole, setFillRole] = useState<"CONTROLLER" | "PROCESSOR">("PROCESSOR");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

  const { data: templates, isLoading } = trpc.skills.listTemplatesWithAccess.useQuery({ language: locale });

  // Fetch parameter schema when a contract type is selected
  const { data: parameterSchema } = trpc.deal.getParameterSchema.useQuery(
    { contractType: selectedType! },
    { enabled: !!selectedType }
  );
  // Parameters applicable to the chosen jurisdiction (some are jurisdiction-scoped, e.g. Spain-only forum city)
  const visibleParameters = useMemo(() => {
    const schema = parameterSchema as ParameterSchema | null;
    if (!schema?.parameters?.length) return [];
    return schema.parameters.filter(
      (p) =>
        !p.jurisdictions?.length ||
        (selectedJurisdiction !== null && p.jurisdictions.includes(selectedJurisdiction))
    );
  }, [parameterSchema, selectedJurisdiction]);

  // Pre-fill default values when the applicable parameter set changes
  useEffect(() => {
    if (!visibleParameters.length) return;
    const defaults: Record<string, string> = {};
    for (const p of visibleParameters) {
      if (p.default && !parameterValues[p.id]) {
        defaults[p.id] = p.default;
      }
    }
    if (Object.keys(defaults).length > 0) {
      setParameterValues((prev) => ({ ...defaults, ...prev }));
    }
    // parameterValues is read only to avoid clobbering user input; re-running on
    // every keystroke would re-apply defaults to fields the user cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleParameters]);
  // Query kept for cache warm-up of billing config used elsewhere; its
  // selfServiceUpgrade flag is not consumed on this page today.
  trpc.billing.getConfig.useQuery();
  const allFamilies = templates ? groupTemplatesByFamily(templates) : [];
  // Filter: only show families where at least one template supports the current platform locale
  // Sort: free templates first, locked (premium) templates at the bottom
  const templateFamilies = allFamilies
    .filter((family) =>
      family.templates.some((t) => t.languages.length === 0 || t.languages.includes(locale))
    )
    .sort((a, b) => {
      const aLocked = a.templates.every((t) => t.requiresLicense && !t.hasAccess);
      const bLocked = b.templates.every((t) => t.requiresLicense && !t.hasAccess);
      return Number(aLocked) - Number(bLocked);
    });

  // Derive unique categories from template families
  const categories = useMemo(() => {
    const cats = new Set<string>();
    templateFamilies.forEach(f => { if (f.category) cats.add(f.category); });
    return Array.from(cats).sort();
  }, [templateFamilies]);

  // Filter families by selected category and search query
  const filteredFamilies = useMemo(() => {
    let result = templateFamilies;
    if (selectedCategory) {
      result = result.filter(f => f.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.displayName.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [templateFamilies, selectedCategory, searchQuery]);

  // Reset selection when filter hides the currently selected family
  useEffect(() => {
    if (selectedCategory && selectedFamily) {
      const stillVisible = templateFamilies.some(
        f => f.family === selectedFamily && f.category === selectedCategory
      );
      if (!stillVisible) {
        setSelectedFamily(null);
        setSelectedType(null);
      }
    }
    // Intentionally runs only on category change: reacting to selectedFamily/
    // templateFamilies would clear a selection the user just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Compute available jurisdictions/languages for the selected family
  const selectedFamilyGroup = templateFamilies.find((f) => f.family === selectedFamily);
  const availableJurisdictions = new Set<string>();
  const availableLanguages = new Set<string>();
  if (selectedFamilyGroup) {
    for (const t of selectedFamilyGroup.templates) {
      for (const j of t.jurisdictions) availableJurisdictions.add(j);
      for (const l of t.languages) availableLanguages.add(l);
    }
  }

  // Compute available languages after jurisdiction is selected
  const languagesForJurisdiction = new Set<string>();
  if (selectedFamilyGroup && selectedJurisdiction) {
    for (const t of selectedFamilyGroup.templates) {
      if (t.jurisdictions.length === 0 || t.jurisdictions.includes(selectedJurisdiction)) {
        for (const l of t.languages) languagesForJurisdiction.add(l);
      }
    }
  }
  const createDeal = trpc.deal.create.useMutation({
    onSuccess: (deal) => {
      toast.success(t("dealRoomCreated"));
      router.push(`/deals/${deal.id}/negotiate`);
    },
    onError: (error) => {
      // Check if this is an entitlement/access error
      if (error.data?.code === "FORBIDDEN") {
        setEntitlementError(error.message);
      } else {
        toast.error(t("createFailed", { error: error.message }));
      }
    },
  });

  // Resolve which template to use when jurisdiction changes
  const resolveTemplate = (family: string, jurisdiction: GoverningLaw) => {
    if (!templates) return;
    const familyGroup = templateFamilies.find((f) => f.family === family);
    if (!familyGroup) return;

    // Find native template for this jurisdiction
    const nativeTemplate = familyGroup.templates.find(
      (t) => t.nativeJurisdiction === jurisdiction
    );
    if (nativeTemplate) {
      setSelectedType(nativeTemplate.contractType);
      setResolvedNativeTemplate(nativeTemplate.contractType);
    } else {
      // Fall back to primary template
      setSelectedType(familyGroup.primaryTemplate.contractType);
      setResolvedNativeTemplate(null);
    }
  };

  const handleCreate = () => {
    // For multi-jurisdiction (soloModeOnly), derive governingLaw from jurisdictions parameter
    const currentTemplate = templates?.find((tmpl) => tmpl.contractType === selectedType);
    let effectiveJurisdiction = selectedJurisdiction;
    if (currentTemplate?.soloModeOnly && !selectedJurisdiction && parameterValues.jurisdictions) {
      const firstJurisdiction = parameterValues.jurisdictions.split(",")[0]?.trim();
      if (firstJurisdiction) {
        effectiveJurisdiction =
          governingLawForSkillJurisdiction(firstJurisdiction) ?? (firstJurisdiction as GoverningLaw);
      }
    }

    // Specific error before the generic "complete all fields" toast.
    // soloModeOnly types like Privacy Notice expect their jurisdiction
    // to come from a parameter, not the picker, so the user needs to
    // know which control to look at.
    if (currentTemplate?.soloModeOnly && !effectiveJurisdiction) {
      toast.error(t("selectJurisdictionParam"));
      return;
    }

    if (!selectedType || !effectiveJurisdiction || !dealName.trim()) {
      toast.error(t("completeAllFields"));
      return;
    }

    // Validate required parameters (only those applicable to the chosen jurisdiction)
    if (visibleParameters.length) {
      const missing = visibleParameters.filter(
        (p) => p.required && !parameterValues[p.id]?.trim()
      );
      if (missing.length > 0) {
        setMissingParams(new Set(missing.map((p) => p.id)));
        const missingLabels = missing.map((p) => resolveParamString(p.label, locale)).join(", ");
        toast.error(`${t("parameterRequired")}: ${missingLabels}`);
        return;
      }
    }
    setMissingParams(new Set());

    createDeal.mutate({
      name: dealName.trim(),
      contractType: selectedType,
      governingLaw: effectiveJurisdiction,
      contractLanguage: selectedLanguage,
      dealMode,
      initiatorCompany: company.trim() || undefined,
      parameters: visibleParameters.length > 0 ? parameterValues : undefined,
      fillRole: selectedType === "DPA" ? fillRole : undefined,
    });
  };

  const selectedJurisdictionMeta = jurisdictionMeta.find(
    (j) => j.value === selectedJurisdiction
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{t("createNewDeal")}</h1>
          <p className="text-muted-foreground mt-1">{t("loadingContractTypes")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-brutal animate-pulse h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("createNewDeal")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("selectContractType")}
        </p>
      </div>

      <PromoBanner />

      {/* Entitlement Error Modal */}
      <Dialog open={!!entitlementError} onOpenChange={(open) => !open && setEntitlementError(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <DialogTitle>{t("accessRequired")}</DialogTitle>
                <DialogDescription className="mt-1">
                  {entitlementError}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <button
              onClick={() => setEntitlementError(null)}
              className="px-4 py-2 border border-border text-sm hover:bg-muted/50 rounded-full"
            >
              {tCommon("close")}
            </button>
            <a
              href={getContactMailto("Dealroom Access Request")}
              className="btn-brutal inline-flex items-center gap-2 text-sm"
            >
              {t("contactUs")}
              <ArrowRight className="w-4 h-4" />
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Self-service purchase modal for locked premium templates */}
      {enableModalSkill && (
        <EnableFeatureModal
          open
          onClose={() => setEnableModalSkill(null)}
          skillPackageId={enableModalSkill.id}
          skillName={enableModalSkill.name}
          returnUrl="/deals/new"
        />
      )}

      {/* Step 1: Contract Type Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
            1
          </div>
          <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("contractType")}
          </Label>
        </div>

        {/* Collapsed summary when a contract type is selected */}
        {selectedFamily && (() => {
          const family = templateFamilies.find((f) => f.family === selectedFamily);
          if (!family) return null;
          const Icon = contractIcons[family.primaryTemplate.contractType] || FileText;
          return (
            <button
              onClick={() => {
                setSelectedFamily(null);
                setSelectedType(null);
                setSelectedJurisdiction(null);
                setResolvedNativeTemplate(null);
                setParameterValues({});
                setMissingParams(new Set());
              }}
              className="card-brutal text-left w-full border-primary relative group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="hidden sm:flex shrink-0 w-10 h-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{family.displayName}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t("negotiableClauses", { count: family.primaryTemplate.clauseCount })}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="hidden sm:inline">{tCommon("change")}</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </button>
          );
        })()}

        {/* Full grid when no contract type is selected */}
        {!selectedFamily && (
          <>
            {/* Search + category filters */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchContracts")}
                className="input-brutal pl-10 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-2.5 min-h-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {categories.length > 1 && (
              <div className="relative">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`
                    shrink-0 px-4 py-2.5 min-h-[44px] rounded-full text-sm font-medium border transition-colors
                    ${selectedCategory === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground"}
                  `}
                >
                  {t("allCategories")}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`
                      shrink-0 px-4 py-2.5 min-h-[44px] rounded-full text-sm font-medium border transition-colors
                      ${selectedCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground"}
                    `}
                  >
                    {cat}
                  </button>
                ))}
                </div>
                {/* Fade-out cue on the right edge so users see there's
                    more horizontal content; pointer-events-none so the
                    last chip stays tappable underneath. Only visible on
                    mobile widths where scroll is actually needed. */}
                <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
              </div>
            )}
            {filteredFamilies.length === 0 && searchQuery.trim() && (
              <div className="card-brutal p-8 sm:p-12 text-center">
                <Search className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">{t("noContractsFound")}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredFamilies.map((family) => {
                const Icon = contractIcons[family.primaryTemplate.contractType] || FileText;
                // A family is locked if ALL its templates require license and user has no access
                const isLocked = family.templates.every((t) => t.requiresLicense && !t.hasAccess);
                const variantCount = family.templates.length;

                return (
                  <button
                    key={family.family}
                    onClick={() => {
                      if (isLocked) {
                        if (family.primaryTemplate.skillPackageId) {
                          setEnableModalSkill({ id: family.primaryTemplate.skillPackageId, name: family.displayName });
                        } else {
                          setEntitlementError(t("toUseContract"));
                        }
                        return;
                      }
                      setSelectedFamily(family.family);
                      setSelectedType(family.primaryTemplate.contractType);
                      setResolvedNativeTemplate(null);
                      // Auto-set deal mode based on template config
                      if (family.primaryTemplate.soloModeOnly || family.primaryTemplate.soloModeDefault) {
                        setDealMode("SOLO");
                      } else {
                        setDealMode("NEGOTIATION");
                      }
                      // For soloModeOnly, auto-set jurisdiction (user picks multi-jurisdiction via parameters)
                      if (family.primaryTemplate.soloModeOnly && family.primaryTemplate.jurisdictions.length > 0) {
                        // Jurisdiction tags may be more specific than GoverningLaw
                        // (e.g. DELAWARE → US framework) — resolve before setting.
                        setSelectedJurisdiction(
                          governingLawForSkillJurisdiction(family.primaryTemplate.jurisdictions[0]) ??
                            (family.primaryTemplate.jurisdictions[0] as GoverningLaw)
                        );
                      } else {
                        // Reset jurisdiction when changing contract type
                        setSelectedJurisdiction(null);
                      }
                    }}
                    className={`
                      card-brutal text-left relative transition-colors
                      ${isLocked
                        ? "border-warning/50 opacity-75"
                        : "hover:border-muted-foreground"
                      }
                    `}
                  >
                    {isLocked && (
                      <span className="absolute top-4 right-4 bg-warning/20 text-warning text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {t("premiumSkill", { price: formatPrice(9) })}
                      </span>
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`
                        hidden sm:flex w-10 h-10 items-center justify-center rounded-xl
                        ${isLocked
                          ? "bg-warning/20 text-warning"
                          : "bg-muted text-muted-foreground"
                        }
                      `}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{family.displayName}</h3>
                        <p className={`text-sm mt-1 ${isLocked ? "text-warning font-medium" : "text-muted-foreground"}`}>
                          {isLocked
                            ? t("clickToEnable")
                            : t("negotiableClauses", { count: family.primaryTemplate.clauseCount })
                          }
                        </p>
                        {variantCount > 1 && !isLocked && (
                          <p className="text-xs text-primary mt-1">
                            {t("jurisdictionVariants", { count: variantCount })}
                          </p>
                        )}
                      </div>
                    </div>
                    {family.description && (
                      <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                        {family.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Step 2: Governing Law Selection (hidden for soloModeOnly — uses multiSelect parameter) */}
      {selectedFamily && !templates?.find((tmpl) => tmpl.contractType === selectedType)?.soloModeOnly && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
              2
            </div>
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("governingLaw")}
            </Label>
            <span className="text-xs text-muted-foreground">({t("cannotChangeLater")})</span>
          </div>

          <div className="card-brutal border-yellow-500/50 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <Scale className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t("determinesLegalFramework")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("governingLawExplainer")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {jurisdictionMeta.map((jurisdiction) => {
              const isSelected = selectedJurisdiction === jurisdiction.value;
              const isDisabled = availableJurisdictions.size > 0 && !availableJurisdictions.has(jurisdiction.value);

              return (
                <button
                  key={jurisdiction.value}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    setSelectedJurisdiction(jurisdiction.value);
                    if (selectedFamily) {
                      resolveTemplate(selectedFamily, jurisdiction.value);
                    }
                    // Auto-select language if only one available for this jurisdiction
                    if (selectedFamilyGroup) {
                      const langs = new Set<string>();
                      for (const tmpl of selectedFamilyGroup.templates) {
                        if (tmpl.jurisdictions.length === 0 || tmpl.jurisdictions.includes(jurisdiction.value)) {
                          for (const l of tmpl.languages) langs.add(l);
                        }
                      }
                      if (langs.size === 1) {
                        setSelectedLanguage([...langs][0] as ContractLanguage);
                      } else if (!langs.has(selectedLanguage)) {
                        // Reset if current language not available
                        setSelectedLanguage([...langs][0] as ContractLanguage || "en");
                      }
                    }
                  }}
                  className={`
                    card-brutal text-left relative transition-colors p-4
                    ${isDisabled
                      ? "opacity-50 cursor-not-allowed border-dashed"
                      : isSelected
                      ? "border-primary"
                      : "hover:border-muted-foreground"
                    }
                  `}
                >
                  {isSelected && !isDisabled && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{jurisdiction.flag}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{t(`jurisdictions.${jurisdiction.tKey}`)}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isDisabled
                          ? t("notAvailableForContract")
                          : t(`jurisdictions.${jurisdiction.tKey}Description`)
                        }
                      </p>
                      {/* Show native template badge if available for this jurisdiction */}
                      {!isDisabled && selectedFamily && (() => {
                        const familyGroup = templateFamilies.find((f) => f.family === selectedFamily);
                        const hasNative = familyGroup?.templates.some(
                          (tmpl) => tmpl.nativeJurisdiction === jurisdiction.value
                        );
                        return hasNative ? (
                          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 font-medium">
                            <Scale className="w-3 h-3" />
                            {t("nativeTemplateAvailable")}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {t("defaultForum", { court: t(`jurisdictions.${jurisdiction.tKey}Court`) })}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Native template indicator */}
      {resolvedNativeTemplate && selectedJurisdiction && (
        <div className="card-brutal border-emerald-500/50 bg-emerald-500/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <Scale className="w-5 h-5 text-emerald-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                {t("nativeTemplate", { jurisdiction: selectedJurisdictionMeta ? t(`jurisdictions.${selectedJurisdictionMeta.tKey}`) : "" })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("nativeTemplateDescription")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 (or 2 for soloModeOnly): Contract Language Selection */}
      {selectedFamily && selectedJurisdiction && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
              {templates?.find((tmpl) => tmpl.contractType === selectedType)?.soloModeOnly ? 2 : 3}
            </div>
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("contractLanguage")}
            </Label>
          </div>

          <div className="card-brutal border-blue-500/50 bg-blue-500/5">
            <div className="flex items-start gap-3">
              <Languages className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t("contractLanguageExplainer")}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contractLanguageMeta.map((lang) => {
              const isSelected = selectedLanguage === lang.value;
              const isDisabled = languagesForJurisdiction.size > 0 && !languagesForJurisdiction.has(lang.value);

              return (
                <button
                  key={lang.value}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) setSelectedLanguage(lang.value);
                  }}
                  className={`
                    card-brutal text-left relative transition-colors p-4
                    ${isDisabled
                      ? "opacity-50 cursor-not-allowed border-dashed"
                      : isSelected
                      ? "border-primary"
                      : "hover:border-muted-foreground"
                    }
                  `}
                >
                  {isSelected && !isDisabled && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{t(`languages.${lang.tKey}`)}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isDisabled
                        ? t("notAvailableForContract")
                        : t(`languages.${lang.tKey}Description`)
                      }
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Deal Mode (only for templates that support both modes) */}
      {selectedFamily && selectedJurisdiction && (() => {
        const currentTemplate = templates?.find((tmpl) => tmpl.contractType === selectedType);
        const showModeSelector = currentTemplate?.soloModeSupported && !currentTemplate?.soloModeDefault && !currentTemplate?.soloModeOnly;
        if (!showModeSelector) return null;
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
                4
              </div>
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {locale === "es" ? "Modo" : "Mode"}
              </Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setDealMode("SOLO")}
                className={`card-brutal text-left relative transition-colors p-4 ${
                  dealMode === "SOLO" ? "border-primary" : "hover:border-muted-foreground"
                }`}
              >
                {dealMode === "SOLO" && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                    dealMode === "SOLO" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{locale === "es" ? "Configurar y descargar" : "Configure & download"}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {locale === "es"
                        ? "Selecciona las opciones y descarga el documento para firma manual"
                        : "Select options and download the document for offline signing"}
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setDealMode("NEGOTIATION")}
                className={`card-brutal text-left relative transition-colors p-4 ${
                  dealMode === "NEGOTIATION" ? "border-primary" : "hover:border-muted-foreground"
                }`}
              >
                {dealMode === "NEGOTIATION" && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                    dealMode === "NEGOTIATION" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{locale === "es" ? "Negociar con contraparte" : "Negotiate with counterparty"}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {locale === "es"
                        ? "Invita a la otra parte para negociar las cláusulas"
                        : "Invite the other party to negotiate clause options"}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Step 5 (or 4): Deal Details */}
      {selectedFamily && selectedJurisdiction && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
                {(() => {
                  const ct = templates?.find((tmpl) => tmpl.contractType === selectedType);
                  if (ct?.soloModeOnly) return 3;
                  return ct?.soloModeSupported && !ct?.soloModeDefault ? 5 : 4;
                })()}
              </div>
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("dealDetails")}
              </Label>
            </div>

            <div className="card-brutal space-y-6">
              {/* Summary of selections */}
              <div className="p-3 bg-muted/30 border border-border text-sm rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("contract")}</span>
                  <span className="font-medium">
                    {templates?.find((tmpl) => tmpl.contractType === selectedType)?.displayName}
                    {resolvedNativeTemplate && (
                      <span className="ml-2 text-xs text-emerald-600 font-normal">{t("nativeBadge")}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">{t("governingLaw")}:</span>
                  <span className="font-medium">
                    {selectedJurisdictionMeta?.flag} {selectedJurisdictionMeta ? t(`jurisdictions.${selectedJurisdictionMeta.tKey}`) : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">{t("contractLanguage")}:</span>
                  <span className="font-medium">
                    {t(`languages.${contractLanguageMeta.find((l) => l.value === selectedLanguage)?.tKey ?? "english"}`)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dealName">{t("dealName")} *</Label>
                <Input
                  id="dealName"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  placeholder={t("dealNamePlaceholder")}
                  className={`input-brutal ${!dealName.trim() ? "border-primary" : ""}`}
                />
                <p className="text-xs text-muted-foreground">
                  {t("dealNameDescription")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">{t("yourCompany")} ({tCommon("optional")})</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={t("yourCompanyPlaceholder")}
                  className={`input-brutal ${!company.trim() ? "border-primary" : ""}`}
                />
                <p className="text-xs text-muted-foreground">
                  {t("yourCompanyDescription")}
                </p>
              </div>

              {/* DPA: which role the initiator takes. In SOLO the other role's
                  block is left blank; in NEGOTIATION the counterparty takes the
                  other role. Set here so the choice flows consistently into the
                  download, signing and generated document. */}
              {selectedType === "DPA" && (
                <DpaRoleSelector value={fillRole} onChange={setFillRole} mode={dealMode} />
              )}
            </div>
          </div>

          {/* Deal Parameters (conditional) */}
          {visibleParameters.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
                  {(() => {
                    const ct = templates?.find((tmpl) => tmpl.contractType === selectedType);
                    if (ct?.soloModeOnly) return 4;
                    return (ct?.soloModeSupported && !ct?.soloModeDefault ? 6 : 5);
                  })()}
                </div>
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {t("dealParameters")}
                </Label>
              </div>

              <div className="card-brutal space-y-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t("dealParametersDescription")}
                  </p>
                  {visibleParameters.some((p) => p.required) && (
                    <p className="text-xs text-muted-foreground shrink-0">
                      <span className="text-destructive">*</span> {t("requiredFieldsLegend")}
                    </p>
                  )}
                </div>
                {visibleParameters.map((param) => (
                  <ParameterField
                    key={param.id}
                    param={param}
                    value={parameterValues[param.id] || ""}
                    onChange={(val) => {
                      setParameterValues((prev) => ({ ...prev, [param.id]: val }));
                      setMissingParams((prev) => { const next = new Set(prev); next.delete(param.id); return next; });
                    }}
                    jurisdiction={selectedJurisdiction!}
                    lang={locale}
                    error={missingParams.has(param.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {t("selectOptionsNext")}
            </p>
            <button
              onClick={handleCreate}
              disabled={!dealName.trim() || createDeal.isPending}
              className="btn-brutal flex items-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createDeal.isPending ? t("creating") : tCommon("continue")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Parameter field component ──────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  CALIFORNIA: "$",
  ENGLAND_WALES: "£",
  SPAIN: "€",
};

function ParameterField({
  param,
  value,
  onChange,
  jurisdiction,
  lang,
  error,
}: {
  param: ParameterDefinition;
  value: string;
  onChange: (val: string) => void;
  jurisdiction: GoverningLaw;
  lang: string;
  error?: boolean;
}) {
  const t = useTranslations("newDeal");
  const label = resolveParamString(param.label, lang);
  const hint = resolveParamString(param.hint, lang);
  const placeholder = resolveParamString(param.placeholder, lang);
  const currencySymbol = CURRENCY_SYMBOLS[jurisdiction] || "$";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`param-${param.id}`}>
        {label}
        {param.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {param.type === "multiSelect" && param.options ? (
        <div className="flex flex-wrap gap-2">
          {param.options.map((opt) => {
            const selected = value.split(",").filter(Boolean);
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = value.split(",").filter(Boolean);
                  const next = isSelected
                    ? current.filter((v) => v !== opt)
                    : [...current, opt];
                  onChange(next.join(","));
                }}
                className={`px-3 py-2.5 min-h-[44px] rounded-full text-sm border transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground"
                }`}
              >
                {param.optionLabels?.[opt]
                  ? resolveParamString(param.optionLabels[opt], lang)
                  : opt === "CALIFORNIA" ? `🇺🇸 ${t("jurisdictions.california")}` :
                  opt === "ENGLAND_WALES" ? `🇬🇧 ${t("jurisdictions.englandWales")}` :
                  opt === "SPAIN" ? `🇪🇸 ${t("jurisdictions.spain")}` : opt}
              </button>
            );
          })}
        </div>
      ) : param.type === "choice" && param.options ? (
        <div className="flex flex-wrap gap-2">
          {param.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-2.5 min-h-[44px] rounded-full text-sm border transition-colors ${
                value === opt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : param.type === "textarea" ? (
        <textarea
          id={`param-${param.id}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`input-brutal w-full resize-y ${error ? "border-destructive" : ""}`}
        />
      ) : (
        <div className="relative">
          {param.type === "currency" && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              {currencySymbol}
            </span>
          )}
          <Input
            id={`param-${param.id}`}
            type={param.type === "number" ? "number" : param.type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`input-brutal ${param.type === "currency" ? "pl-7" : ""} ${
              param.type === "percentage" ? "pr-8" : ""
            } ${error ? "border-destructive" : ""}`}
          />
          {param.type === "percentage" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              %
            </span>
          )}
        </div>
      )}
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
