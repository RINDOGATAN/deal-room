"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslations } from "next-intl";
import { Scale, MapPin, Languages, CheckCircle2, Search } from "lucide-react";
import { RequestRecommendationDialog } from "@/components/RequestRecommendationDialog";

type GoverningLaw = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";

const jurisdictionKeys: Record<string, string> = {
  CALIFORNIA: "jurisdictionCalifornia",
  ENGLAND_WALES: "jurisdictionEnglandWales",
  SPAIN: "jurisdictionSpain",
};

const languageKeys: Record<string, string> = {
  en: "languageEnglish",
  es: "languageSpanish",
};

export default function LawyerDirectoryPage() {
  const t = useTranslations("directory");
  const tCommon = useTranslations("common");
  const [filterJurisdiction, setFilterJurisdiction] = useState<GoverningLaw | "">("");
  const [filterLanguage, setFilterLanguage] = useState<string>("");
  const [selectedLawyerId, setSelectedLawyerId] = useState<string | null>(null);
  const [selectedLawyerJurisdictions, setSelectedLawyerJurisdictions] = useState<GoverningLaw[]>([]);

  const { data: lawyers, isLoading } = trpc.lawyer.directory.useQuery(
    {
      jurisdiction: filterJurisdiction || undefined,
      language: filterLanguage || undefined,
    },
  );

  const selectedLawyer = lawyers?.find((l) => l.userId === selectedLawyerId);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterJurisdiction}
          onChange={(e) => setFilterJurisdiction(e.target.value as GoverningLaw | "")}
          aria-label={t("allJurisdictions")}
          className="px-3 py-2 text-sm border border-border rounded-full bg-background text-foreground"
        >
          <option value="">{t("allJurisdictions")}</option>
          <option value="CALIFORNIA">{tCommon("jurisdictionCalifornia")}</option>
          <option value="ENGLAND_WALES">{tCommon("jurisdictionEnglandWales")}</option>
          <option value="SPAIN">{tCommon("jurisdictionSpain")}</option>
        </select>
        <select
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
          aria-label={t("allLanguages")}
          className="px-3 py-2 text-sm border border-border rounded-full bg-background text-foreground"
        >
          <option value="">{t("allLanguages")}</option>
          <option value="en">{tCommon("languageEnglish")}</option>
          <option value="es">{tCommon("languageSpanish")}</option>
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-brutal animate-pulse h-48" />
          ))}
        </div>
      ) : !lawyers?.length ? (
        <div className="card-brutal text-center py-12">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            {filterJurisdiction || filterLanguage ? t("noLawyersFiltered") : t("noLawyers")}
          </h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lawyers.map((lawyer) => (
            <div key={lawyer.id} className="card-brutal flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                {lawyer.user.image ? (
                  <img
                    src={lawyer.user.image}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-full">
                    <Scale className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{lawyer.user.name || lawyer.user.email}</h3>
                  {lawyer.user.company && (
                    <p className="text-sm text-muted-foreground truncate">{lawyer.user.company}</p>
                  )}
                </div>
              </div>

              {lawyer.bio && (
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{lawyer.bio}</p>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {lawyer.jurisdictions.map((j) => (
                  <span key={j} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-secondary rounded-full">
                    <MapPin className="w-3 h-3" />
                    {tCommon(jurisdictionKeys[j] || j)}
                  </span>
                ))}
                {lawyer.languages.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-secondary rounded-full">
                    <Languages className="w-3 h-3" />
                    {tCommon(languageKeys[l] || l)}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("approvedVettings", { count: lawyer.approvedVettingCount })}
                </span>
                <button
                  onClick={() => {
                    setSelectedLawyerId(lawyer.userId);
                    setSelectedLawyerJurisdictions(lawyer.jurisdictions as GoverningLaw[]);
                  }}
                  className="btn-brutal text-xs px-3 py-1.5"
                >
                  {t("requestRecommendation")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request Dialog */}
      {selectedLawyerId && (
        <RequestRecommendationDialog
          open={!!selectedLawyerId}
          onOpenChange={(open) => !open && setSelectedLawyerId(null)}
          lawyerId={selectedLawyerId}
          lawyerName={selectedLawyer?.user.name || selectedLawyer?.user.email || ""}
          lawyerJurisdictions={selectedLawyerJurisdictions}
        />
      )}
    </div>
  );
}
