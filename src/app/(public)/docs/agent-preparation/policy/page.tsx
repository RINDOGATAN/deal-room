"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  FileText,
  Building,
  Gauge,
  ListChecks,
  ShieldAlert,
  Scale,
  Users,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const policyTemplate = `# Agent Negotiation Policy
# [Organization Name]

## Organization Identity
- Industry: [e.g., Healthcare / SaaS / Financial Services]
- Size: [e.g., 50 employees, Series B]
- Primary Jurisdiction: [e.g., California]
- Regulatory Constraints: [e.g., HIPAA, GDPR, SOX]

## Risk Profile: [Conservative / Moderate / Aggressive]

## Clause Priorities

### Data Handling — CRITICAL
- Preferred: Delete all data on termination
- Reasoning: We handle PHI; retention creates compliance risk
- Flexibility: LOW (1-2)

### Liability — HIGH
- Preferred: Cap at 12 months' fees
- Reasoning: Board-mandated maximum exposure
- Flexibility: LOW (2)

### SLA / Uptime — MODERATE
- Preferred: 99.9% uptime
- Acceptable: 99% with service credits
- Flexibility: MODERATE (3)

### IP Ownership — HIGH
- Preferred: Consumer owns all outputs
- Reasoning: Outputs feed our proprietary models
- Flexibility: LOW (1-2)

### Dispute Resolution — MODERATE
- Preferred: Gavel automated arbitration
- Acceptable: Any arbitration (no courts)
- Flexibility: HIGH (4)

## Red Lines (Non-Negotiable)
1. Data handling: MUST be delete or anonymize on termination
   - Reason: HIPAA § 164.530(j) retention limits
2. Governing law: MUST be California
   - Reason: Board policy, existing legal infrastructure

## Dispute Resolution Preferences
- Protocol: Gavel (gavel.todo.law)
- Tiers: All 4 (automated → AI mediation → AI arbitration → human)
- Escrow: Up to 5% of claim value on Base L2 (USDC)
- Precedent: Opt in to both publishing and querying

## Escalation Rules
- Pause negotiation if overall satisfaction < 60%
- Require human approval for contracts > $50,000/year
- Alert legal team if any red line is triggered`;

const conservativeExample = `# Agent Policy — MedTech Solutions Inc.
# Risk Profile: CONSERVATIVE

## Identity
Healthcare data analytics company, 200 employees,
California. SOC 2 Type II certified. Handles PHI
under BAAs with 40+ hospital systems.

## Red Lines (4)
1. Data: DELETE on termination only (no anonymize)
2. Liability: Minimum $500,000 cap
3. Governing law: California only
4. Audit rights: Full audit access required

## Flexibility Defaults
- All clauses start at flexibility 2 (low)
- Data handling clauses: flexibility 1
- Dispute resolution: flexibility 4 (flexible)

## Escalation
- ALWAYS require human approval
- No autonomous contract signing`;

const aggressiveExample = `# Agent Policy — Velocit AI (Startup)
# Risk Profile: AGGRESSIVE

## Identity
Pre-seed AI agent startup, 8 people, remote-first.
Moving fast, needs to sign API access and tool
license agreements quickly to ship product.

## Red Lines (1)
1. IP: Consumer must own outputs
   (our models depend on output ownership)

## Flexibility Defaults
- All clauses start at flexibility 4 (high)
- IP ownership: flexibility 1
- Everything else: negotiate freely

## Escalation
- Autonomous up to $5,000/month contracts
- Flag anything above for founder review`;

export default function PolicyPage() {
  const t = useTranslations("agentPrepPolicy");

  const templateSections = [
    {
      titleKey: "templateIdentityTitle",
      descKey: "templateIdentityDesc",
      icon: Building,
    },
    {
      titleKey: "templateRiskTitle",
      descKey: "templateRiskDesc",
      icon: Gauge,
    },
    {
      titleKey: "templatePrioritiesTitle",
      descKey: "templatePrioritiesDesc",
      icon: ListChecks,
    },
    {
      titleKey: "templateRedLinesTitle",
      descKey: "templateRedLinesDesc",
      icon: ShieldAlert,
    },
    {
      titleKey: "templateDisputeTitle",
      descKey: "templateDisputeDesc",
      icon: Scale,
    },
    {
      titleKey: "templateEscalationTitle",
      descKey: "templateEscalationDesc",
      icon: Users,
    },
  ];

  const mistakes = [
    { titleKey: "mistake1Title", descKey: "mistake1Desc" },
    { titleKey: "mistake2Title", descKey: "mistake2Desc" },
    { titleKey: "mistake3Title", descKey: "mistake3Desc" },
    { titleKey: "mistake4Title", descKey: "mistake4Desc" },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* What Is / What Is Not */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("whatIsTitle")}</h2>
        <p className="text-muted-foreground">{t("whatIsDesc")}</p>

        <div className="p-5 border border-border bg-muted/30 rounded-2xl">
          <h3 className="font-bold mb-2">{t("whatIsNotTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("whatIsNotDesc")}</p>
        </div>
      </div>

      {/* Policy Template */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("templateTitle")}</h2>
        <p className="text-muted-foreground">{t("templateDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templateSections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.titleKey}
                className="p-4 border border-border rounded-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    {t(section.titleKey)}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(section.descKey)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Full template */}
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b border-border">
            <p className="text-xs font-mono text-muted-foreground">
              agent-policy.md
            </p>
          </div>
          <pre className="p-4 text-xs text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
            {policyTemplate}
          </pre>
        </div>
      </div>

      {/* Example Policies */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("examplesTitle")}</h2>
        <p className="text-muted-foreground">{t("examplesDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Conservative */}
          <div className="border border-red-500/30 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-red-500/5 border-b border-red-500/30">
              <p className="font-bold text-sm">
                {t("exampleConservativeTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("exampleConservativeProfile")}
              </p>
            </div>
            <pre className="p-4 text-xs text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {conservativeExample}
            </pre>
          </div>

          {/* Aggressive */}
          <div className="border border-emerald-500/30 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-emerald-500/5 border-b border-emerald-500/30">
              <p className="font-bold text-sm">
                {t("exampleAggressiveTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("exampleAggressiveProfile")}
              </p>
            </div>
            <pre className="p-4 text-xs text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {aggressiveExample}
            </pre>
          </div>
        </div>
      </div>

      {/* Common Mistakes */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("mistakesTitle")}</h2>
        <div className="space-y-3">
          {mistakes.map((mistake) => (
            <div
              key={mistake.titleKey}
              className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl"
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="font-medium text-sm text-amber-500">
                  {t(mistake.titleKey)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(mistake.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Next Step */}
      <div className="p-6 border border-primary/30 bg-primary/5 rounded-2xl">
        <h2 className="text-xl font-bold mb-2">{t("nextStepTitle")}</h2>
        <p className="text-muted-foreground mb-4">{t("nextStepDesc")}</p>
        <Link
          href="/docs/agent-preparation/playbook"
          className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
        >
          <FileText className="w-4 h-4" />
          {t("nextStepTitle")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
