"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import {
  FileText,
  Shield,
  Briefcase,
  Cloud,
  ArrowRight,
  Check,
  Scale,
  Languages,
} from "lucide-react";
import { Label } from "@/components/ui/label";

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
type ContractLanguage = "en" | "es";

const jurisdictionOptions: {
  value: GoverningLaw;
  label: string;
  flag: string;
  description: string;
}[] = [
  { value: "CALIFORNIA", label: "California, USA", flag: "\u{1f1fa}\u{1f1f8}", description: "U.S. law framework" },
  { value: "ENGLAND_WALES", label: "England & Wales, UK", flag: "\u{1f1ec}\u{1f1e7}", description: "English common law" },
  { value: "SPAIN", label: "Spain, EU", flag: "\u{1f1ea}\u{1f1f8}", description: "Spanish civil law" },
];

const languageOptions: { value: ContractLanguage; label: string; description: string }[] = [
  { value: "en", label: "English", description: "Contract in English" },
  { value: "es", label: "Español", description: "Contrato en español" },
];

function resolveLocalized(localized: unknown, locale: string, fallback: string): string {
  if (!localized || typeof localized !== "object") return fallback;
  const map = localized as Record<string, string>;
  return map[locale] || map["en"] || fallback;
}

interface TemplateInfo {
  id: string;
  contractType: string;
  displayName: string;
  description: string | null;
  clauseCount: number;
  jurisdictions: string[];
  languages: string[];
  requiresLicense: boolean;
  hasAccess: boolean;
}

export default function NewVettingPage() {
  const router = useRouter();
  const t = useTranslations("lawyer");
  const tNew = useTranslations("newDeal");
  const locale = useLocale();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<GoverningLaw | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<ContractLanguage>("en");

  const { data: templates, isLoading } = trpc.skills.listTemplatesWithAccess.useQuery({ language: locale });

  const createVetting = trpc.lawyer.createVetting.useMutation({
    onSuccess: (vetting) => {
      router.push(`/lawyer/vettings/${vetting.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  // Available jurisdictions for selected template
  const availableJurisdictions = selectedTemplate
    ? new Set(selectedTemplate.jurisdictions)
    : new Set<string>();
  const availableLanguages = selectedTemplate && selectedJurisdiction
    ? new Set(selectedTemplate.languages)
    : new Set<string>();

  const handleCreate = () => {
    if (!selectedTemplateId || !selectedJurisdiction) return;
    createVetting.mutate({
      contractTemplateId: selectedTemplateId,
      governingLaw: selectedJurisdiction,
      contractLanguage: selectedLanguage,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">{t("vetNewTemplate")}</h1>
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
        <h1 className="text-2xl font-bold">{t("vetNewTemplate")}</h1>
        <p className="text-muted-foreground mt-1">{t("selectTemplate")}</p>
      </div>

      {/* Step 1: Template Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">1</div>
          <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{tNew("contractType")}</Label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {templates?.map((template) => {
            const Icon = contractIcons[template.contractType] || FileText;
            const isSelected = selectedTemplateId === template.id;

            return (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setSelectedJurisdiction(null);
                }}
                className={`card-brutal text-left relative transition-colors ${
                  isSelected ? "border-primary" : "hover:border-muted-foreground"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{template.displayName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tNew("negotiableClauses", { count: template.clauseCount })}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Jurisdiction */}
      {selectedTemplateId && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">2</div>
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{tNew("governingLaw")}</Label>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {jurisdictionOptions.map((j) => {
              const isSelected = selectedJurisdiction === j.value;
              const isDisabled = availableJurisdictions.size > 0 && !availableJurisdictions.has(j.value);
              return (
                <button
                  key={j.value}
                  disabled={isDisabled}
                  onClick={() => {
                    setSelectedJurisdiction(j.value);
                    // Auto-select language if only one available
                    if (selectedTemplate) {
                      const langs = selectedTemplate.languages;
                      if (langs.length === 1) setSelectedLanguage(langs[0] as ContractLanguage);
                    }
                  }}
                  className={`card-brutal text-left relative transition-colors p-4 ${
                    isDisabled ? "opacity-50 cursor-not-allowed border-dashed"
                    : isSelected ? "border-primary" : "hover:border-muted-foreground"
                  }`}
                >
                  {isSelected && !isDisabled && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{j.flag}</div>
                    <div>
                      <h3 className="font-semibold">{j.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{j.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Language */}
      {selectedTemplateId && selectedJurisdiction && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold rounded-full">3</div>
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{tNew("contractLanguage")}</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {languageOptions.map((lang) => {
              const isSelected = selectedLanguage === lang.value;
              const isDisabled = availableLanguages.size > 0 && !availableLanguages.has(lang.value);
              return (
                <button
                  key={lang.value}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setSelectedLanguage(lang.value)}
                  className={`card-brutal text-left relative transition-colors p-4 ${
                    isDisabled ? "opacity-50 cursor-not-allowed border-dashed"
                    : isSelected ? "border-primary" : "hover:border-muted-foreground"
                  }`}
                >
                  {isSelected && !isDisabled && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary flex items-center justify-center rounded-full">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <h3 className="font-semibold">{lang.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{lang.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Continue button */}
      {selectedTemplateId && selectedJurisdiction && (
        <div className="flex justify-end pt-4 border-t border-border animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={handleCreate}
            disabled={createVetting.isPending}
            className="btn-brutal flex items-center gap-2"
          >
            {createVetting.isPending ? tNew("creating") : t("reviewClauses")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
