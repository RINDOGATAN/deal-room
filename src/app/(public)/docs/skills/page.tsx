"use client";

import { useTranslations } from "next-intl";
import {
  FileCode,
  Layers,
  Scale,
  Globe,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

export default function SkillsPage() {
  const t = useTranslations("skills");

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* What is a Skill */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("whatIsTitle")}</h2>
        <p className="text-muted-foreground">{t("whatIsDesc")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <FileCode className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("contractStructureTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("contractStructureDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Layers className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("clauseTemplatesTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("clauseTemplatesDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Scale className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("biasScoresTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("biasScoresDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("jurisdictionRulesTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("jurisdictionRulesDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Skill Package Structure */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("packageTitle")}</h2>
        <p className="text-muted-foreground">{t("packageDesc")}</p>
        <div className="p-5 border border-border bg-card font-mono text-sm rounded-2xl">
          <div className="space-y-1">
            <p className="text-muted-foreground">skill-package.zip/</p>
            <p className="pl-4">
              <span className="text-primary">manifest.json</span>
              <span className="text-muted-foreground ml-4">
                # {t("packageManifestComment")}
              </span>
            </p>
            <p className="pl-4">
              <span className="text-foreground">contract-template.json</span>
              <span className="text-muted-foreground ml-4">
                # {t("packageContractComment")}
              </span>
            </p>
            <p className="pl-4">
              <span className="text-foreground">clauses/</span>
              <span className="text-muted-foreground ml-4">
                # {t("packageClausesComment")}
              </span>
            </p>
            <p className="pl-8 text-muted-foreground">payment-terms.json</p>
            <p className="pl-8 text-muted-foreground">liability.json</p>
            <p className="pl-8 text-muted-foreground">termination.json</p>
            <p className="pl-4">
              <span className="text-foreground">i18n/</span>
              <span className="text-muted-foreground ml-4">
                # {t("packageI18nComment")}
              </span>
            </p>
            <p className="pl-8 text-muted-foreground">en.json</p>
            <p className="pl-8 text-muted-foreground">es.json</p>
          </div>
        </div>
      </div>

      {/* Clause Structure */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("clauseStructureTitle")}</h2>
        <p className="text-muted-foreground">{t("clauseStructureDesc")}</p>

        {/* Example Clause */}
        <div className="border border-border p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs px-2 py-1 bg-muted text-muted-foreground border border-border rounded-full">
                {t("exampleClauseCategory")}
              </span>
              <h3 className="font-bold text-lg mt-2">
                {t("exampleClauseTitle")}
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {t("exampleClauseOptionCount")}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("exampleClauseDesc")}
          </p>

          {/* Options */}
          <div className="space-y-3">
            <div className="p-4 border border-blue-400/30 bg-blue-400/5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {t("exampleOptionATitle")}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-400/20 text-blue-400 border border-blue-400/30 rounded-full">
                  {t("favorsPartyA")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {t("exampleOptionADesc")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-primary font-medium mb-1">
                    {t("prosForA")}
                  </p>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>{t("exampleOptionAPro1")}</li>
                    <li>{t("exampleOptionAPro2")}</li>
                  </ul>
                </div>
                <div>
                  <p className="text-amber-400 font-medium mb-1">
                    {t("consForA")}
                  </p>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>{t("exampleOptionACon1")}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 border border-border rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {t("exampleOptionBTitle")}
                </span>
                <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground border border-border rounded-full">
                  {t("balanced")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("exampleOptionBDesc")}
              </p>
            </div>

            <div className="p-4 border border-orange-400/30 bg-orange-400/5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {t("exampleOptionCTitle")}
                </span>
                <span className="text-xs px-2 py-0.5 bg-orange-400/20 text-orange-400 border border-orange-400/30 rounded-full">
                  {t("favorsPartyB")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("exampleOptionCDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Taster vs Premium */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("tiersTitle")}</h2>
        <p className="text-muted-foreground">{t("tiersDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Unlock className="w-6 h-6 text-muted-foreground" />
              <h3 className="text-lg font-bold">{t("tasterTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("tasterDesc")}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("tasterFeature1")}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("tasterFeature2")}</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span>{t("tasterLimit1")}</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span>{t("tasterLimit2")}</span>
              </li>
            </ul>
          </div>

          <div className="border border-primary p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-bold text-primary">
                {t("premiumTitle")}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("premiumDesc")}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("premiumFeature1")}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("premiumFeature2")}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("premiumFeature3")}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("premiumFeature4")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Multilingual Support */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("multilingualTitle")}</h2>
        <p className="text-muted-foreground">{t("multilingualDesc")}</p>

        <div className="card-brutal p-5">
          <div className="flex items-center gap-6">
            <div className="flex-1 p-4 border border-blue-400/30 bg-blue-400/5 rounded-xl">
              <p className="text-xs text-blue-400 mb-1">
                {t("multilingualPartyALabel")}
              </p>
              <p className="font-medium">{t("multilingualPartyAOption")}</p>
              <p className="text-sm text-muted-foreground">
                {t("multilingualPartyADesc")}
              </p>
            </div>
            <div className="text-muted-foreground">=</div>
            <div className="flex-1 p-4 border border-orange-400/30 bg-orange-400/5 rounded-xl">
              <p className="text-xs text-orange-400 mb-1">
                {t("multilingualPartyBLabel")}
              </p>
              <p className="font-medium">{t("multilingualPartyBOption")}</p>
              <p className="text-sm text-muted-foreground">
                {t("multilingualPartyBDesc")}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            {t("multilingualFootnote")}
          </p>
        </div>
      </div>

      {/* Licensing */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("licenseTitle")}</h2>
        <p className="text-muted-foreground">{t("licenseDesc")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border border-border rounded-xl text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <p className="text-sm font-medium">{t("licenseStep1")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("licenseStep1Sub")}
            </p>
          </div>
          <div className="p-4 border border-border rounded-xl text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <p className="text-sm font-medium">{t("licenseStep2")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("licenseStep2Sub")}
            </p>
          </div>
          <div className="p-4 border border-border rounded-xl text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold">
              3
            </div>
            <p className="text-sm font-medium">{t("licenseStep3")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("licenseStep3Sub")}
            </p>
          </div>
          <div className="p-4 border border-primary rounded-xl text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-primary bg-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground">
              4
            </div>
            <p className="text-sm font-medium text-primary">
              {t("licenseStep4")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("licenseStep4Sub")}
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border border-border rounded-xl text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">{t("cliCommandsLabel")}</strong>
          </p>
          <code className="block mt-2 text-xs">
            npm run license:fingerprint # Get machine ID
            <br />
            npm run skill:list # View installed skills
          </code>
        </div>
      </div>
    </div>
  );
}
