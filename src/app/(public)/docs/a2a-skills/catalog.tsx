"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  Globe,
  Languages,
  Scale,
  Shield,
  Zap,
  Bot,
} from "lucide-react";

interface SkillOption {
  code: string;
  label: string;
  order: number;
  plainDescription: string;
  biasPartyA: number;
  biasPartyB: number;
  localizedContent: Record<string, unknown> | null;
}

interface SkillClause {
  clauseId: string;
  title: string;
  category: string;
  order: number;
  plainDescription: string;
  isRequired: boolean;
  localizedContent: Record<string, unknown> | null;
  options: SkillOption[];
}

interface Skill {
  contractType: string;
  displayName: string;
  displayNameLocalized: Record<string, string> | null;
  description: string | null;
  descriptionLocalized: Record<string, string> | null;
  jurisdictions: string[];
  languages: string[];
  categoryLocalized: Record<string, string> | null;
  clauses: SkillClause[];
}

function localize(
  dbValue: string,
  localized: Record<string, unknown> | null | undefined,
  field: string,
  locale: string,
): string {
  if (localized && typeof localized[field] === "object" && localized[field] !== null) {
    const map = localized[field] as Record<string, string>;
    return map[locale] || map.en || dbValue;
  }
  return dbValue;
}

function localizeTop(
  dbValue: string | null,
  localized: Record<string, string> | null | undefined,
  locale: string,
): string {
  if (localized) {
    return localized[locale] || localized.en || dbValue || "";
  }
  return dbValue || "";
}

function biasLabel(biasA: number, biasB: number): { text: string; color: string } {
  if (Math.abs(biasA) < 0.05 && Math.abs(biasB) < 0.05)
    return { text: "Balanced", color: "text-muted-foreground bg-muted border-border" };
  if (biasA > 0.15)
    return { text: "Favors Party A", color: "text-blue-500 bg-blue-500/10 border-blue-500/30" };
  if (biasB > 0.15)
    return { text: "Favors Party B", color: "text-orange-500 bg-orange-500/10 border-orange-500/30" };
  return { text: "Balanced", color: "text-muted-foreground bg-muted border-border" };
}

const JURISDICTION_LABELS: Record<string, string> = {
  CALIFORNIA: "California",
  DELAWARE: "Delaware",
  ENGLAND_WALES: "England & Wales",
  SPAIN: "Spain",
};

function SkillCard({ skill, locale }: { skill: Skill; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const t = useTranslations("a2aSkills");

  const name = localizeTop(skill.displayName, skill.displayNameLocalized, locale);
  const desc = localizeTop(skill.description, skill.descriptionLocalized, locale);

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-6 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs font-mono text-muted-foreground">
                {skill.contractType}
              </span>
            </div>
            <h3 className="text-lg font-bold">{name}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{desc}</p>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Scale className="w-3 h-3" />
                {skill.clauses.length} {t("clauses")}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {skill.jurisdictions.map((j) => JURISDICTION_LABELS[j] || j).join(", ")}
              </span>
              <span className="flex items-center gap-1">
                <Languages className="w-3 h-3" />
                {skill.languages.map((l) => l.toUpperCase()).join(" / ")}
              </span>
            </div>
          </div>

          <ChevronDown
            className={`w-5 h-5 text-muted-foreground flex-shrink-0 mt-1 transition-transform ${
              expanded ? "rotate-0" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {/* Expanded clause list */}
      {expanded && (
        <div className="border-t border-border">
          <div className="p-4 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t("negotiableClauses")}
            </p>

            <div className="space-y-2">
              {skill.clauses.map((clause) => {
                const clauseTitle = localize(
                  clause.title,
                  clause.localizedContent,
                  "title",
                  locale,
                );
                const clauseDesc = localize(
                  clause.plainDescription,
                  clause.localizedContent,
                  "plainDescription",
                  locale,
                );
                const isClauseExpanded = expandedClause === clause.clauseId;

                return (
                  <div
                    key={clause.clauseId}
                    className="border border-border rounded-xl bg-card overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedClause(isClauseExpanded ? null : clause.clauseId)
                      }
                      className="w-full text-left p-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground border border-border rounded-full">
                              {localize(
                                clause.category,
                                clause.localizedContent,
                                "category",
                                locale,
                              )}
                            </span>
                            {clause.clauseId === "dispute-resolution" && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/30 rounded-full flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Gavel
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold mt-1.5">{clauseTitle}</h4>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                            {clauseDesc}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {clause.options.length} {t("options")}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-muted-foreground transition-transform ${
                              isClauseExpanded ? "rotate-0" : "-rotate-90"
                            }`}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Options */}
                    {isClauseExpanded && (
                      <div className="border-t border-border p-4 space-y-3">
                        {clause.options.map((option) => {
                          const optLabel = localize(
                            option.label,
                            option.localizedContent,
                            "label",
                            locale,
                          );
                          const optDesc = localize(
                            option.plainDescription,
                            option.localizedContent,
                            "plainDescription",
                            locale,
                          );
                          const bias = biasLabel(option.biasPartyA, option.biasPartyB);

                          return (
                            <div
                              key={option.code}
                              className="p-3 border border-border rounded-lg"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-medium text-sm">{optLabel}</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 border rounded-full ${bias.color}`}
                                >
                                  {bias.text}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{optDesc}</p>
                              {clause.clauseId === "dispute-resolution" &&
                                option.code.toUpperCase().includes("GAVEL") && (
                                  <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
                                    <p className="text-[10px] text-primary flex items-center gap-1">
                                      <Zap className="w-3 h-3" />
                                      {t("gavelRecommended")}
                                    </p>
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function A2aSkillsCatalog({ skills }: { skills: Skill[] }) {
  const locale = useLocale();
  const t = useTranslations("a2aSkills");

  if (skills.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("emptyState")}</p>
      </div>
    );
  }

  const totalClauses = skills.reduce((sum, s) => sum + s.clauses.length, 0);
  const totalOptions = skills.reduce(
    (sum, s) => sum + s.clauses.reduce((cs, c) => cs + c.options.length, 0),
    0,
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-3">{t("title")}</h1>
        <p className="text-lg text-muted-foreground mb-4">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/30 rounded-full font-medium">
            {skills.length} {t("contractTypes")}
          </span>
          <span className="px-3 py-1 bg-muted text-muted-foreground border border-border rounded-full">
            {totalClauses} {t("negotiableTerms")}
          </span>
          <span className="px-3 py-1 bg-muted text-muted-foreground border border-border rounded-full">
            {totalOptions} {t("optionVariants")}
          </span>
        </div>
      </div>

      {/* Explanation */}
      <div className="border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold">{t("howItWorksTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("howItWorksDesc")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">{t("step1Title")}</p>
            <p className="text-xs text-muted-foreground">{t("step1Desc")}</p>
          </div>
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">{t("step2Title")}</p>
            <p className="text-xs text-muted-foreground">{t("step2Desc")}</p>
          </div>
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">{t("step3Title")}</p>
            <p className="text-xs text-muted-foreground">{t("step3Desc")}</p>
          </div>
        </div>
      </div>

      {/* Catalog */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("catalogTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("catalogDesc")}</p>

        <div className="space-y-4">
          {skills.map((skill) => (
            <SkillCard key={skill.contractType} skill={skill} locale={locale} />
          ))}
        </div>
      </div>
    </div>
  );
}
