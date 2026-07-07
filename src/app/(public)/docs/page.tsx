"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Workflow,
  Package,
  Scale,
  ArrowRight,
  Shield,
} from "lucide-react";

const sectionDefs = [
  {
    href: "/docs/how-it-works",
    icon: Workflow,
    titleKey: "sectionLifecycleTitle",
    descKey: "sectionLifecycleDesc",
  },
  {
    href: "/docs/compromise",
    icon: Scale,
    titleKey: "sectionCompromiseTitle",
    descKey: "sectionCompromiseDesc",
  },
  {
    href: "/docs/skills",
    icon: Package,
    titleKey: "sectionSkillsTitle",
    descKey: "sectionSkillsDesc",
  },
  {
    href: "/docs/agent-preparation",
    icon: Shield,
    titleKey: "sectionAgentPrepTitle",
    descKey: "sectionAgentPrepDesc",
  },
];

export default function DocsPage() {
  const t = useTranslations("docsHome");

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">
          {t.rich("heroTitle", {
            highlight: (chunks) => (
              <span className="text-primary">{chunks}</span>
            ),
          })}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          {t("heroSubtitle")}
        </p>
      </div>

      {/* Value Props */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-brutal p-4">
          <p className="font-semibold mb-1">{t("propAsyncTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("propAsyncDesc")}
          </p>
        </div>
        <div className="card-brutal p-4">
          <p className="font-semibold mb-1">{t("propAlgorithmTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("propAlgorithmDesc")}
          </p>
        </div>
        <div className="card-brutal p-4">
          <p className="font-semibold mb-1">{t("propAttorneyTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("propAttorneyDesc")}
          </p>
        </div>
      </div>

      {/* Section Cards */}
      <div>
        <h2 className="text-xl font-bold mb-6">{t("sectionsHeading")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sectionDefs.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group card-brutal block p-6 hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl border border-border flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                      {t(section.titleKey)}
                      <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(section.descKey)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Start */}
      <div className="border border-primary/30 p-6 bg-primary/5 rounded-2xl">
        <h2 className="text-xl font-bold mb-4">{t("quickStartHeading")}</h2>
        <div className="space-y-3">
          <p className="text-muted-foreground">
            {t("quickStartIntro")}
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <span className="text-foreground font-medium">{t("step1Label")}</span>{" "}
              <span className="text-muted-foreground">
                — {t("step1Desc")}
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                {t("step2Label")}
              </span>{" "}
              <span className="text-muted-foreground">
                — {t("step2Desc")}
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                {t("step3Label")}
              </span>{" "}
              <span className="text-muted-foreground">
                — {t("step3Desc")}
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                {t("step4Label")}
              </span>{" "}
              <span className="text-muted-foreground">
                — {t("step4Desc")}
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                {t("step5Label")}
              </span>{" "}
              <span className="text-muted-foreground">
                — {t("step5Desc")}
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                {t("step6Label")}
              </span>{" "}
              <span className="text-muted-foreground">
                — {t("step6Desc")}
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
