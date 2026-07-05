"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Clock,
  Bot,
  Users,
  Scale,
  Zap,
  ArrowRight,
} from "lucide-react";

const basicDrc = `{
  "@context": "https://protocol.gavel.legal/v1",
  "@type": "GavelDRC",
  "parties": [
    {
      "id": "did:web:your-agent.example.com",
      "type": "agent",
      "principal": "did:web:your-org.example.com"
    },
    {
      "id": "did:web:counterparty-agent.example.com",
      "type": "agent",
      "principal": "did:web:counterparty.example.com"
    }
  ],
  "disputeParameters": {
    "governingLaw": "US-CA",
    "seat": "virtual",
    "language": "en",
    "maxClaimValue": {
      "amount": 50000,
      "currency": "USDC"
    }
  },
  "resolutionTiers": [
    {
      "tier": 1,
      "method": "automated-negotiation",
      "timeLimit": "PT4H"
    },
    {
      "tier": 2,
      "method": "ai-mediation",
      "timeLimit": "P3D",
      "neutralCounsel": false
    },
    {
      "tier": 3,
      "method": "ai-arbitration",
      "timeLimit": "P7D",
      "neutralCounsel": true
    },
    {
      "tier": 4,
      "method": "human-arbitration",
      "timeLimit": "P14D",
      "neutralCounsel": true
    }
  ],
  "escrow": {
    "chain": "base",
    "token": "USDC",
    "stakePercentage": 5,
    "releaseConditions": {
      "mutualAgreement": true,
      "arbitralAward": true
    }
  },
  "precedentOpt": {
    "publishAnonymized": true,
    "queryPrecedent": true
  }
}`;

const microDrc = `{
  "@context": "https://protocol.gavel.legal/v1",
  "@type": "GavelDRC",
  "disputeParameters": {
    "governingLaw": "US-CA",
    "seat": "virtual",
    "language": "en",
    "maxClaimValue": { "amount": 1000, "currency": "USDC" }
  },
  "resolutionTiers": [
    { "tier": 1, "method": "automated-negotiation", "timeLimit": "PT2H" },
    { "tier": 2, "method": "ai-mediation", "timeLimit": "P1D" }
  ],
  "escrow": {
    "chain": "base", "token": "USDC",
    "stakePercentage": 2,
    "releaseConditions": { "mutualAgreement": true, "arbitralAward": true }
  },
  "precedentOpt": { "publishAnonymized": true, "queryPrecedent": true }
}`;

const enterpriseDrc = `{
  "@context": "https://protocol.gavel.legal/v1",
  "@type": "GavelDRC",
  "disputeParameters": {
    "governingLaw": "GB",
    "seat": "London",
    "language": "en",
    "maxClaimValue": { "amount": 500000, "currency": "USDC" }
  },
  "resolutionTiers": [
    { "tier": 1, "method": "automated-negotiation", "timeLimit": "PT8H" },
    { "tier": 2, "method": "ai-mediation", "timeLimit": "P5D", "neutralCounsel": true },
    { "tier": 3, "method": "ai-arbitration", "timeLimit": "P14D", "neutralCounsel": true },
    { "tier": 4, "method": "human-arbitration", "timeLimit": "P30D", "neutralCounsel": true }
  ],
  "escrow": {
    "chain": "ethereum", "token": "USDC",
    "stakePercentage": 10,
    "releaseConditions": { "mutualAgreement": true, "arbitralAward": true }
  },
  "precedentOpt": { "publishAnonymized": false, "queryPrecedent": true }
}`;

export default function DisputesPage() {
  const t = useTranslations("agentPrepDisputes");

  const tiers = [
    {
      titleKey: "tier1Title",
      timeKey: "tier1Time",
      descKey: "tier1Desc",
      icon: Zap,
      color: "emerald",
    },
    {
      titleKey: "tier2Title",
      timeKey: "tier2Time",
      descKey: "tier2Desc",
      icon: Bot,
      color: "blue",
    },
    {
      titleKey: "tier3Title",
      timeKey: "tier3Time",
      descKey: "tier3Desc",
      icon: Scale,
      color: "amber",
    },
    {
      titleKey: "tier4Title",
      timeKey: "tier4Time",
      descKey: "tier4Desc",
      icon: Users,
      color: "red",
    },
  ];

  const drcFields = [
    { key: "drcFieldParties", label: "parties" },
    { key: "drcFieldDispute", label: "disputeParameters" },
    { key: "drcFieldTiers", label: "resolutionTiers" },
    { key: "drcFieldEscrow", label: "escrow" },
    { key: "drcFieldPrecedent", label: "precedentOpt" },
  ];

  const configItems = [
    { titleKey: "configTiersTitle", descKey: "configTiersDesc" },
    { titleKey: "configEscrowTitle", descKey: "configEscrowDesc" },
    { titleKey: "configChainTitle", descKey: "configChainDesc" },
    { titleKey: "configPrecedentTitle", descKey: "configPrecedentDesc" },
  ];

  const templates = [
    {
      titleKey: "templateMicroTitle",
      descKey: "templateMicroDesc",
      drc: microDrc,
      color: "emerald",
    },
    {
      titleKey: "templateStandardTitle",
      descKey: "templateStandardDesc",
      drc: basicDrc,
      color: "blue",
    },
    {
      titleKey: "templateEnterpriseTitle",
      descKey: "templateEnterpriseDesc",
      drc: enterpriseDrc,
      color: "amber",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Why */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("whyTitle")}</h2>
        <p className="text-muted-foreground">{t("whyDesc")}</p>
      </div>

      {/* Gavel 4-Tier Timeline */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("gavelTitle")}</h2>
        <p className="text-muted-foreground">{t("gavelDesc")}</p>

        <div className="space-y-3">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.titleKey}
                className={`p-5 border border-${tier.color}-500/30 bg-${tier.color}-500/5 rounded-xl`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 text-${tier.color}-500`}
                    />
                    <h3 className={`font-bold text-${tier.color}-500`}>
                      {t(tier.titleKey)}
                    </h3>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {t(tier.timeKey)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(tier.descKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* DRC */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("drcTitle")}</h2>
        <p className="text-muted-foreground">{t("drcDesc")}</p>

        {/* Annotated DRC */}
        <div className="space-y-4">
          <h3 className="font-bold">{t("drcAnnotatedTitle")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2 bg-muted border-b border-border">
                <p className="text-xs font-mono text-muted-foreground">
                  drc.json
                </p>
              </div>
              <pre className="p-4 text-xs text-muted-foreground overflow-x-auto leading-relaxed">
                {basicDrc}
              </pre>
            </div>
            <div className="space-y-3">
              {drcFields.map((field) => (
                <div
                  key={field.key}
                  className="p-3 border border-border rounded-xl"
                >
                  <p className="font-mono text-xs text-primary mb-1">
                    {field.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(field.key)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Decisions */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("configTitle")}</h2>
        <p className="text-muted-foreground">{t("configDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configItems.map((item) => (
            <div
              key={item.titleKey}
              className="p-4 border border-border rounded-xl"
            >
              <h3 className="font-semibold text-sm mb-1">
                {t(item.titleKey)}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(item.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Built Templates */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("templatesTitle")}</h2>
        <p className="text-muted-foreground">{t("templatesDesc")}</p>

        <div className="space-y-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.titleKey}
              className={`border border-${tmpl.color}-500/30 rounded-2xl overflow-hidden`}
            >
              <div
                className={`px-4 py-3 bg-${tmpl.color}-500/5 border-b border-${tmpl.color}-500/30`}
              >
                <p className="font-bold text-sm">{t(tmpl.titleKey)}</p>
                <p className="text-xs text-muted-foreground">
                  {t(tmpl.descKey)}
                </p>
              </div>
              <pre className="p-4 text-xs text-muted-foreground overflow-x-auto leading-relaxed">
                {tmpl.drc}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Connection to Dealroom */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("connectionTitle")}</h2>
        <p className="text-muted-foreground">{t("connectionDesc")}</p>
      </div>

      {/* Escalation */}
      <div className="p-6 border border-border rounded-2xl space-y-3">
        <h2 className="text-xl font-bold">{t("escalationTitle")}</h2>
        <p className="text-muted-foreground">{t("escalationDesc")}</p>
        <div className="p-3 bg-muted rounded-lg font-mono text-xs">
          <p className="text-primary">{t("escalationEndpoint")}</p>
          <p className="text-muted-foreground">{t("escalationScope")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("escalationNote")}</p>
        <Link
          href="/docs/agent-api"
          className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline"
        >
          Agent API Reference
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
