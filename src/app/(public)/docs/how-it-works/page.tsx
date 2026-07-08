"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import {
  FileText,
  Mail,
  Users,
  Cpu,
  MessageSquare,
  PenTool,
  ArrowRight,
} from "lucide-react";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export default function HowItWorksPage() {
  const t = useTranslations("howItWorks");

  const dealStatuses = [
    { id: "DRAFT", label: t("statusDraft") },
    { id: "AWAITING_RESPONSE", label: t("statusAwaitingResponse") },
    { id: "NEGOTIATING", label: t("statusNegotiating") },
    { id: "AGREED", label: t("statusAgreed") },
    { id: "SIGNING", label: t("statusSigning") },
    { id: "COMPLETED", label: t("statusCompleted") },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Deal Status Flow */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("lifecycleHeading")}</h2>
        <p className="text-muted-foreground">
          {t("lifecycleIntro")}
        </p>
        <div className="overflow-x-auto py-4">
          <FlowDiagram steps={dealStatuses} currentStep="NEGOTIATING" />
        </div>
      </div>

      {/* Detailed Steps */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t("processHeading")}</h2>

        <div className="space-y-4">
          <WorkflowStep
            number={1}
            title={t("ws1Title")}
            description={t("ws1Desc")}
            icon={<FileText className="w-5 h-5" />}
            actor={t("actorInitiator")}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium text-foreground">{t("ws1ContractType")}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {t("ws1ContractTypeDesc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium text-foreground">{t("ws1Jurisdiction")}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {t("ws1JurisdictionDesc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium text-foreground">{t("ws1DealName")}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {t("ws1DealNameDesc")}
                </p>
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={2}
            title={t("ws2Title")}
            description={t("ws2Desc")}
            icon={<Mail className="w-5 h-5" />}
            actor={t("actorInitiator")}
          >
            <div className="p-3 bg-muted/30 border border-border rounded-xl text-sm">
              <p className="text-muted-foreground">
                {t("ws2Detail")}
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={3}
            title={t("ws3Title")}
            description={t("ws3Desc")}
            icon={<Users className="w-5 h-5" />}
            actor={t("actorBothParties")}
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("ws3SelectIntro")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 border border-border rounded-xl">
                  <p className="font-medium text-foreground">{t("ws3Option")}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t("ws3OptionDesc")}
                  </p>
                </div>
                <div className="p-3 border border-border rounded-xl">
                  <p className="font-medium text-foreground">{t("ws3Priority")}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t("ws3PriorityDesc")}
                  </p>
                </div>
                <div className="p-3 border border-border rounded-xl">
                  <p className="font-medium text-foreground">{t("ws3OpenFields")}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t("ws3OpenFieldsDesc")}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("ws3BlindNote")}
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={4}
            title={t("ws4Title")}
            description={t("ws4Desc")}
            icon={<Cpu className="w-5 h-5" />}
            actor={t("actorSystem")}
          >
            <div className="p-4 border border-primary/30 bg-primary/5 rounded-xl">
              <p className="text-sm font-medium text-primary mb-2">
                {t("ws4FormulaLabel")}
              </p>
              <code className="text-xs block p-2 bg-card border border-border rounded-lg text-muted-foreground">
                stake = ((5-flexibility)/5 × 0.6) + (|bias| × 0.4)
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                {t.rich("ws4FormulaNote", {
                  link: (chunks) => (
                    <a href="/docs/compromise" className="text-primary hover:underline">
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={5}
            title={t("ws5Title")}
            description={t("ws5Desc")}
            icon={<MessageSquare className="w-5 h-5" />}
            actor={t("actorBothParties")}
          >
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-primary/30 rounded-xl">
                  <p className="font-medium text-primary">{t("ws5Accept")}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t("ws5AcceptDesc")}
                  </p>
                </div>
                <div className="p-3 border border-border rounded-xl">
                  <p className="font-medium text-foreground">{t("ws5Counter")}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t("ws5CounterDesc")}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("ws5CounterNote")}
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={6}
            title={t("ws6Title")}
            description={t("ws6Desc")}
            icon={<PenTool className="w-5 h-5" />}
            actor={t("actorBothParties")}
          >
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 p-3 border border-border rounded-xl">
                <div className="w-4 h-4 border border-muted-foreground rounded" />
                <span className="text-muted-foreground">{t("ws6PartyA")}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2 p-3 border border-border rounded-xl">
                <div className="w-4 h-4 border border-muted-foreground rounded" />
                <span className="text-muted-foreground">{t("ws6PartyB")}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2 p-3 border border-primary rounded-xl text-primary">
                <div className="w-4 h-4 bg-primary rounded" />
                <span className="font-medium">{t("ws6Complete")}</span>
              </div>
            </div>
          </WorkflowStep>
        </div>
      </div>

      {/* Key Concepts */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("conceptsHeading")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <h3 className="font-bold mb-2">{t("conceptAsyncTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("conceptAsyncDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <h3 className="font-bold mb-2">{t("conceptBlindTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("conceptBlindDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <h3 className="font-bold mb-2">{t("conceptWeightedTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("conceptWeightedDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <h3 className="font-bold mb-2">{t("conceptJurisdictionTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("conceptJurisdictionDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
