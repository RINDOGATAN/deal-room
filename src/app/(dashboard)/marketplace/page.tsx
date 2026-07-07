"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Package,
  CheckCircle2,
  Globe,
  Languages,
  Download,
  ShoppingCart,
  Search,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { PromoBanner } from "@/components/PromoBanner";
import { formatPrice } from "@/lib/currency";
import { useTranslations } from "next-intl";

const JURISDICTION_LABELS: Record<string, string> = {
  CALIFORNIA: "California",
  DELAWARE: "Delaware",
  ENGLAND_WALES: "England & Wales",
  SPAIN: "Spain",
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
};

export default function MarketplacePage() {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [enableSkill, setEnableSkill] = useState<{
    id: string;
    name: string;
    priceAmount?: number;
    priceCurrency?: string;
  } | null>(null);

  const { data: skills, isLoading } =
    trpc.skillManager.listMarketplace.useQuery();

  // Collect all unique jurisdictions and languages
  const { allJurisdictions, allLanguages } = useMemo(() => {
    if (!skills) return { allJurisdictions: [], allLanguages: [] };
    const jurisdictions = new Set<string>();
    const languages = new Set<string>();
    for (const s of skills) {
      for (const j of s.jurisdictions) jurisdictions.add(j);
      for (const l of s.languages) languages.add(l);
    }
    return {
      allJurisdictions: Array.from(jurisdictions).sort(),
      allLanguages: Array.from(languages).sort(),
    };
  }, [skills]);

  const filtered = useMemo(() => {
    if (!skills) return [];
    return skills.filter((s) => {
      if (jurisdictionFilter && !s.jurisdictions.includes(jurisdictionFilter))
        return false;
      if (languageFilter && !s.languages.includes(languageFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !s.displayName.toLowerCase().includes(q) &&
          !s.description?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [skills, jurisdictionFilter, languageFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <PromoBanner />

      {/* Search + filter bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchSkills")}
            className="input-brutal pl-10 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {/* Jurisdiction pills */}
        <button
          onClick={() => setJurisdictionFilter(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            !jurisdictionFilter
              ? "bg-primary/10 text-primary border-primary/30"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
        >
          {t("allJurisdictions")}
        </button>
        {allJurisdictions.map((j) => (
          <button
            key={j}
            onClick={() =>
              setJurisdictionFilter(jurisdictionFilter === j ? null : j)
            }
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              jurisdictionFilter === j
                ? "bg-primary/10 text-primary border-primary/30"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {JURISDICTION_LABELS[j] || j}
          </button>
        ))}

        <span className="text-border mx-1">|</span>

        {/* Language pills */}
        <button
          onClick={() => setLanguageFilter(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            !languageFilter
              ? "bg-primary/10 text-primary border-primary/30"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
        >
          {t("allLanguages")}
        </button>
        {allLanguages.map((l) => (
          <button
            key={l}
            onClick={() =>
              setLanguageFilter(languageFilter === l ? null : l)
            }
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              languageFilter === l
                ? "bg-primary/10 text-primary border-primary/30"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {LANGUAGE_LABELS[l] || l}
          </button>
        ))}
        </div>
      </div>

      {/* Skills grid */}
      {filtered.length === 0 ? (
        <div className="card-brutal p-8 sm:p-12 text-center">
          {searchQuery.trim() ? (
            <Search className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground/50 mb-2" />
          ) : (
            <Package className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground/50 mb-2" />
          )}
          <p className="text-sm text-muted-foreground">{t("noSkillsFound")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((skill) => (
            <div key={skill.id} className="card-brutal p-6 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">
                    {skill.displayName}
                  </h3>
                  {skill.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {skill.description}
                    </p>
                  )}
                </div>
                {/* Status badge */}
                <div className="shrink-0">
                  {skill.isEntitled ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-500/10 text-green-600 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("active")}
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-1 text-sm sm:text-xs font-bold text-primary bg-primary/5 border border-primary/20 rounded-full">
                      {skill.priceAmount
                        ? `${formatPrice(skill.priceAmount / 100)}/${t("month")}`
                        : t("contactUs")}
                    </span>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {skill.jurisdictions.map((j) => (
                  <span
                    key={j}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-secondary text-muted-foreground"
                  >
                    <Globe className="h-3 w-3" />
                    {JURISDICTION_LABELS[j] || j}
                  </span>
                ))}
                {skill.languages.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-secondary text-muted-foreground"
                  >
                    <Languages className="h-3 w-3" />
                    {LANGUAGE_LABELS[l] || l}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto pt-2">
                {skill.isEntitled ? (
                  <>
                    <button
                      onClick={() => router.push("/deals/new")}
                      className="btn-brutal text-xs px-4 py-2 flex-1"
                    >
                      {t("createDeal")}
                    </button>
                    {skill.hasPackageFile && (
                      <a
                        href={`/api/skills/${skill.skillId}/download`}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-full hover:bg-secondary transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("download")}
                      </a>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() =>
                      setEnableSkill({
                        id: skill.id,
                        name: skill.displayName,
                        priceAmount: skill.priceAmount ?? undefined,
                        priceCurrency: skill.priceCurrency ?? undefined,
                      })
                    }
                    className="btn-brutal text-xs px-4 py-2 flex-1 flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {t("enable")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enable feature modal */}
      {enableSkill && (
        <EnableFeatureModal
          open={!!enableSkill}
          onClose={() => setEnableSkill(null)}
          skillPackageId={enableSkill.id}
          skillName={enableSkill.name}
          priceAmount={enableSkill.priceAmount}
          priceCurrency={enableSkill.priceCurrency}
          returnUrl="/marketplace"
        />
      )}
    </div>
  );
}
