"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  FileText,
  Code,
  Shield,
  AlertTriangle,
  CheckCircle,
  Zap,
  ArrowRight,
} from "lucide-react";

export default function AgentPreparationPage() {
  const t = useTranslations("agentPrep");

  const flowSteps = [
    { key: "flowStep1", descKey: "flowStep1Desc" },
    { key: "flowStep2", descKey: "flowStep2Desc" },
    { key: "flowStep3", descKey: "flowStep3Desc" },
    { key: "flowStep4", descKey: "flowStep4Desc" },
    { key: "flowStep5", descKey: "flowStep5Desc" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("heroHeading")}</h1>
        <p className="text-lg text-muted-foreground">{t("heroDesc")}</p>
      </div>

      {/* The Three Artifacts */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("artifactsTitle")}</h2>
        <p className="text-muted-foreground">{t("artifactsDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-primary/30 bg-primary/5 p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-primary">
                {t("artifactPolicyTitle")}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("artifactPolicyDesc")}
            </p>
          </div>

          <div className="border border-blue-500/30 bg-blue-500/5 p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Code className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-blue-500">
                {t("artifactPlaybookTitle")}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("artifactPlaybookDesc")}
            </p>
          </div>

          <div className="border border-amber-500/30 bg-amber-500/5 p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-amber-500">
                {t("artifactDrcTitle")}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("artifactDrcDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Why Preparation Matters */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("whyTitle")}</h2>
        <p className="text-muted-foreground">{t("whyDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 border border-red-500/30 bg-red-500/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-red-500">{t("withoutTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("withoutDesc")}
            </p>
          </div>

          <div className="p-5 border border-emerald-500/30 bg-emerald-500/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-emerald-500">{t("withTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{t("withDesc")}</p>
          </div>

          <div className="p-5 border border-amber-500/30 bg-amber-500/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-amber-500">{t("withDrcTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("withDrcDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Preparation Flow */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("flowTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {flowSteps.map((step, i) => (
            <div
              key={step.key}
              className="relative p-4 border border-border rounded-xl text-center"
            >
              <div className="w-8 h-8 mx-auto mb-2 border border-primary bg-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground">
                {i + 1}
              </div>
              <p className="text-sm font-medium">{t(step.key)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(step.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("nextStepsTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              href: "/docs/agent-preparation/policy",
              titleKey: "nextPolicyTitle",
              descKey: "nextPolicyDesc",
              icon: FileText,
              color: "primary",
            },
            {
              href: "/docs/agent-preparation/playbook",
              titleKey: "nextPlaybookTitle",
              descKey: "nextPlaybookDesc",
              icon: Code,
              color: "blue-500",
            },
            {
              href: "/docs/agent-preparation/disputes",
              titleKey: "nextDisputesTitle",
              descKey: "nextDisputesDesc",
              icon: Shield,
              color: "amber-500",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group p-5 border border-border rounded-2xl hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-5 h-5 text-${card.color}`} />
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-bold">{t(card.titleKey)}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(card.descKey)}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
