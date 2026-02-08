"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  FileText,
  Shield,
  Briefcase,
  Cloud,
  ArrowRight,
  Check,
  Scale,
  Globe,
  AlertTriangle,
  Languages,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getContactMailto } from "@/config/brand";

const contractIcons: Record<string, typeof FileText> = {
  NDA: Shield,
  DPA: Shield,
  MSA: Briefcase,
  SAAS: Cloud,
  FOUNDERS: Briefcase,
  PACTO_SOCIOS: Briefcase,
  SAFE: FileText,
};

type GoverningLaw = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";

// Template type from the API
interface TemplateInfo {
  id: string;
  contractType: string;
  displayName: string;
  description: string | null;
  version: string;
  clauseCount: number;
  templateFamily: string | null;
  nativeJurisdiction: string | null;
  requiresLicense: boolean;
  hasAccess: boolean;
  entitledJurisdictions: string[];
  expiresAt: Date | null;
}

// Group templates by family for display
interface TemplateFamily {
  family: string;
  displayName: string;
  description: string | null;
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
    result.push(family);
  }

  for (const t of ungrouped) {
    result.push({
      family: t.contractType,
      displayName: t.displayName,
      description: t.description,
      templates: [t],
      primaryTemplate: t,
    });
  }

  return result;
}
type ContractLanguage = "en" | "es";

const contractLanguageOptions: {
  value: ContractLanguage;
  label: string;
  nativeLabel: string;
  description: string;
}[] = [
  {
    value: "en",
    label: "English",
    nativeLabel: "English",
    description: "Contract text in English",
  },
  {
    value: "es",
    label: "Spanish",
    nativeLabel: "Español",
    description: "Texto del contrato en español",
  },
];

const jurisdictionOptions: {
  value: GoverningLaw;
  label: string;
  flag: string;
  description: string;
  defaultCourt: string;
}[] = [
  {
    value: "CALIFORNIA",
    label: "California, USA",
    flag: "🇺🇸",
    description: "U.S. law framework with Silicon Valley standards",
    defaultCourt: "State and federal courts in San Francisco, California",
  },
  {
    value: "ENGLAND_WALES",
    label: "England & Wales, UK",
    flag: "🇬🇧",
    description: "English common law, widely used internationally",
    defaultCourt: "Courts of England and Wales, London",
  },
  {
    value: "SPAIN",
    label: "Spain, EU",
    flag: "🇪🇸",
    description: "Spanish civil law within EU regulatory framework",
    defaultCourt: "Courts of Madrid, Spain",
  },
];

export default function NewDealPage() {
  const router = useRouter();
  const t = useTranslations("newDeal");
  const tCommon = useTranslations("common");
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<GoverningLaw | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<ContractLanguage>("en");
  const [dealName, setDealName] = useState("");
  const [company, setCompany] = useState("");
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [resolvedNativeTemplate, setResolvedNativeTemplate] = useState<string | null>(null);

  const { data: templates, isLoading } = trpc.skills.listTemplatesWithAccess.useQuery();
  const templateFamilies = templates ? groupTemplatesByFamily(templates) : [];
  const createDeal = trpc.deal.create.useMutation({
    onSuccess: (deal) => {
      toast.success("Deal room created");
      router.push(`/deals/${deal.id}/negotiate`);
    },
    onError: (error) => {
      // Check if this is an entitlement/access error
      if (error.data?.code === "FORBIDDEN") {
        setEntitlementError(error.message);
      } else {
        toast.error(`Failed to create deal: ${error.message}`);
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
    if (!selectedType || !selectedJurisdiction || !dealName.trim()) {
      toast.error("Please complete all required fields");
      return;
    }

    createDeal.mutate({
      name: dealName.trim(),
      contractType: selectedType,
      governingLaw: selectedJurisdiction,
      contractLanguage: selectedLanguage,
      initiatorCompany: company.trim() || undefined,
    });
  };

  const selectedJurisdictionInfo = jurisdictionOptions.find(
    (j) => j.value === selectedJurisdiction
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Create New Deal</h1>
          <p className="text-muted-foreground mt-1">Loading contract types...</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
        <h1 className="text-2xl font-bold">Create New Deal</h1>
        <p className="text-muted-foreground mt-1">
          Select a contract type and configure your deal room
        </p>
      </div>

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

      {/* Step 1: Contract Type Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
            1
          </div>
          <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Contract Type
          </Label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {templateFamilies.map((family) => {
            const Icon = contractIcons[family.primaryTemplate.contractType] || FileText;
            const isSelected = selectedFamily === family.family;
            // A family is locked if ALL its templates require license and user has no access
            const isLocked = family.templates.every((t) => t.requiresLicense && !t.hasAccess);
            const variantCount = family.templates.length;

            return (
              <button
                key={family.family}
                onClick={() => {
                  if (isLocked) {
                    setEntitlementError(t("toUseContract"));
                    return;
                  }
                  setSelectedFamily(family.family);
                  setSelectedType(family.primaryTemplate.contractType);
                  setResolvedNativeTemplate(null);
                  // Reset jurisdiction when changing contract type
                  if (family.family !== selectedFamily) {
                    setSelectedJurisdiction(null);
                  }
                }}
                className={`
                  card-brutal text-left relative transition-colors
                  ${isLocked
                    ? "opacity-60 border-dashed"
                    : isSelected
                    ? "border-primary"
                    : "hover:border-muted-foreground"
                  }
                `}
              >
                {isSelected && !isLocked && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                {isLocked && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-muted flex items-center justify-center rounded-full">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className={`
                    w-10 h-10 flex items-center justify-center rounded-xl
                    ${isLocked
                      ? "bg-muted text-muted-foreground"
                      : isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                    }
                  `}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{family.displayName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isLocked
                        ? t("accessRequired")
                        : t("negotiableClauses", { count: family.primaryTemplate.clauseCount })
                      }
                    </p>
                    {variantCount > 1 && !isLocked && (
                      <p className="text-xs text-primary mt-1">
                        {variantCount} jurisdiction variants
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
      </div>

      {/* Step 2: Governing Law Selection */}
      {selectedFamily && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
              2
            </div>
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Governing Law
            </Label>
            <span className="text-xs text-muted-foreground">(cannot be changed later)</span>
          </div>

          <div className="card-brutal border-yellow-500/50 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <Scale className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">This determines the legal framework</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The governing law affects which clauses are presented and their default options.
                  This choice is final and will apply to the entire agreement.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {jurisdictionOptions.map((jurisdiction) => {
              const isSelected = selectedJurisdiction === jurisdiction.value;

              return (
                <button
                  key={jurisdiction.value}
                  onClick={() => {
                    setSelectedJurisdiction(jurisdiction.value);
                    if (selectedFamily) {
                      resolveTemplate(selectedFamily, jurisdiction.value);
                    }
                  }}
                  className={`
                    card-brutal text-left relative transition-colors p-4
                    ${isSelected
                      ? "border-primary"
                      : "hover:border-muted-foreground"
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{jurisdiction.flag}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{jurisdiction.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {jurisdiction.description}
                      </p>
                      {/* Show native template badge if available for this jurisdiction */}
                      {selectedFamily && (() => {
                        const familyGroup = templateFamilies.find((f) => f.family === selectedFamily);
                        const hasNative = familyGroup?.templates.some(
                          (t) => t.nativeJurisdiction === jurisdiction.value
                        );
                        return hasNative ? (
                          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 font-medium">
                            <Scale className="w-3 h-3" />
                            Native law template available
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Default forum: {jurisdiction.defaultCourt}
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
                Native {jurisdictionOptions.find((j) => j.value === selectedJurisdiction)?.label} template
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Using jurisdiction-native clauses authored specifically for this legal system, not translated from another jurisdiction.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Contract Language Selection */}
      {selectedFamily && selectedJurisdiction && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
              3
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

          <div className="grid grid-cols-2 gap-3">
            {contractLanguageOptions.map((lang) => {
              const isSelected = selectedLanguage === lang.value;

              return (
                <button
                  key={lang.value}
                  onClick={() => setSelectedLanguage(lang.value)}
                  className={`
                    card-brutal text-left relative transition-colors p-4
                    ${isSelected
                      ? "border-primary"
                      : "hover:border-muted-foreground"
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{lang.nativeLabel}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lang.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Deal Details */}
      {selectedFamily && selectedJurisdiction && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">
                4
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
                      <span className="ml-2 text-xs text-emerald-600 font-normal">(native)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">{t("governingLaw")}:</span>
                  <span className="font-medium">
                    {selectedJurisdictionInfo?.flag} {selectedJurisdictionInfo?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">{t("contractLanguage")}:</span>
                  <span className="font-medium">
                    {contractLanguageOptions.find((l) => l.value === selectedLanguage)?.nativeLabel}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dealName">Deal Name *</Label>
                <Input
                  id="dealName"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  placeholder="e.g., Acme Corp Partnership NDA"
                  className="input-brutal"
                />
                <p className="text-xs text-muted-foreground">
                  A descriptive name to identify this deal
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Your Company (Optional)</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g., Your Company Inc."
                  className="input-brutal"
                />
                <p className="text-xs text-muted-foreground">
                  Will be shown to the other party
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              You'll select your preferred options next
            </p>
            <button
              onClick={handleCreate}
              disabled={!dealName.trim() || createDeal.isPending}
              className="btn-brutal flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createDeal.isPending ? "Creating..." : "Continue"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
