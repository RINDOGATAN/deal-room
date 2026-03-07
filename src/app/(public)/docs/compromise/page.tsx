"use client";

import { useTranslations } from "next-intl";
import { Scale, Calculator, BarChart3, RefreshCw } from "lucide-react";
import { CompromiseDemo } from "../components/CompromiseDemo";

export default function CompromisePage() {
  const t = useTranslations("compromise");

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* The Problem */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("problemTitle")}</h2>
        <p className="text-muted-foreground">{t("problemDesc")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
            <p className="font-medium text-amber-400">
              {t("problemPowerImbalance")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("problemPowerImbalanceDesc")}
            </p>
          </div>
          <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
            <p className="font-medium text-amber-400">
              {t("problemEndlessCycles")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("problemEndlessCyclesDesc")}
            </p>
          </div>
          <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
            <p className="font-medium text-amber-400">
              {t("problemArbitrarySplits")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("problemArbitrarySplitsDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* The Solution */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("solutionTitle")}</h2>
        <p className="text-muted-foreground">{t("solutionDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 border border-primary/30 bg-primary/5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Calculator className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-primary">
                {t("stakeMeasuresTitle")}
              </h3>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">60%</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">
                    {t("stakeInflexibilityLabel")}
                  </strong>{" "}
                  — {t("stakeInflexibilityDesc")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">40%</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">
                    {t("stakeBiasLabel")}
                  </strong>{" "}
                  — {t("stakeBiasDesc")}
                </span>
              </li>
            </ul>
          </div>

          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Scale className="w-5 h-5" />
              <h3 className="font-bold">{t("fairOutcomesTitle")}</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {t("fairOutcome1")}</li>
              <li>• {t("fairOutcome2")}</li>
              <li>• {t("fairOutcome3")}</li>
              <li>• {t("fairOutcome4")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* The Formula */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("formulaTitle")}</h2>
        <div className="p-6 border border-primary bg-card rounded-2xl">
          <code className="text-lg text-primary font-mono">
            stake = ((5-flexibility)/5 × 0.6) + (|bias| × 0.4)
          </code>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 border border-border rounded-xl">
            <p className="font-mono text-primary mb-2">
              (5-flexibility)/5 × 0.6
            </p>
            <p className="text-muted-foreground">
              {t("formulaInflexibilityDesc")}
            </p>
          </div>
          <div className="p-4 border border-border rounded-xl">
            <p className="font-mono text-primary mb-2">|bias| × 0.4</p>
            <p className="text-muted-foreground">{t("formulaBiasDesc")}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {t("formulaResultDesc")}
        </p>
      </div>

      {/* Decision Logic */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("decisionTitle")}</h2>
        <p className="text-muted-foreground">{t("decisionDesc")}</p>

        <div className="space-y-3">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h3 className="font-bold">{t("decisionSimilarTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-9">
              {t("decisionSimilarDesc")}
            </p>
          </div>

          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h3 className="font-bold">{t("decisionHigherTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-9 mb-3">
              {t("decisionHigherDesc")}
            </p>
            <div className="ml-9 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="text-sm font-medium">
                  {t("decisionFlexibleLabel")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("decisionFlexibleDesc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="text-sm font-medium">
                  {t("decisionInflexibleLabel")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("decisionInflexibleDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Fairness */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("fairnessTitle")}</h2>
        <p className="text-muted-foreground">{t("fairnessDesc")}</p>

        <div className="card-brutal p-5">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-5 h-5 text-primary" />
            <h3 className="font-bold">{t("rebalancingTitle")}</h3>
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs flex-shrink-0">
                1
              </span>
              <span className="text-muted-foreground">
                {t("rebalancingStep1")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs flex-shrink-0">
                2
              </span>
              <span className="text-muted-foreground">
                {t("rebalancingStep2")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs flex-shrink-0">
                3
              </span>
              <span className="text-muted-foreground">
                {t("rebalancingStep3")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 border border-primary bg-primary rounded-full flex items-center justify-center text-xs flex-shrink-0 text-primary-foreground">
                4
              </span>
              <span className="text-muted-foreground">
                {t("rebalancingStep4")}
              </span>
            </li>
          </ol>
        </div>
      </div>

      {/* Satisfaction Calculation */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("satisfactionTitle")}</h2>
        <p className="text-muted-foreground">{t("satisfactionDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("distanceFactorTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("distanceFactorDesc")}
            </p>
            <code className="block mt-3 text-xs bg-card p-2 border border-border rounded-lg">
              1 - (distance / maxDistance)
            </code>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Scale className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("biasAdjustmentTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("biasAdjustmentDesc")}
            </p>
            <code className="block mt-3 text-xs bg-card p-2 border border-border rounded-lg">
              ±(bias × 0.15)
            </code>
          </div>
        </div>
      </div>

      {/* Interactive Demo */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("demoTitle")}</h2>
        <p className="text-muted-foreground">{t("demoDesc")}</p>

        <div className="border border-border p-6 bg-card rounded-2xl">
          <CompromiseDemo />
        </div>
      </div>

      {/* Technical Reference */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("techRefTitle")}</h2>
        <div className="p-5 border border-border bg-muted/30 rounded-2xl">
          <p className="text-sm text-muted-foreground mb-3">
            {t("techRefDesc")}
          </p>
          <code className="block text-xs bg-card p-3 border border-border rounded-xl">
            src/server/services/compromise/engine.ts
          </code>
          <p className="text-sm text-muted-foreground mt-3">
            {t("techRefExports")}{" "}
            <code className="text-primary">calculateCompromise()</code>,{" "}
            <code className="text-primary">globalFairnessPass()</code>
          </p>
        </div>
      </div>
    </div>
  );
}
