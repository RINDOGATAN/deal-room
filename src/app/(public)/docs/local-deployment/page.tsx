"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import {
  Store,
  Download,
  Terminal,
  KeyRound,
  ShieldCheck,
  Globe,
  CreditCard,
  Package,
  Fingerprint,
  ChevronRight,
} from "lucide-react";

export default function LocalDeploymentPage() {
  const t = useTranslations("localDeployment");

  const flowSteps = [
    { icon: Store, label: t("flowBrowse"), sub: t("flowBrowseSub") },
    { icon: CreditCard, label: t("flowPurchase"), sub: t("flowPurchaseSub") },
    { icon: Download, label: t("flowDownload"), sub: t("flowDownloadSub") },
    { icon: Terminal, label: t("flowInstall"), sub: t("flowInstallSub") },
    { icon: ShieldCheck, label: t("flowActivate"), sub: t("flowActivateSub") },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Overview Flow — visual pipeline */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("howItWorks")}</h2>
        <p className="text-muted-foreground">{t("howItWorksDesc")}</p>

        {/* Horizontal flow (desktop) / vertical (mobile) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {flowSteps.map((step, i) => (
            <div key={i} className="relative">
              <div className="p-4 border border-border rounded-xl text-center h-full">
                <div
                  className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
                    i === 4
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border border-muted-foreground"
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.sub}
                </p>
              </div>
              {i < 4 && (
                <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Browse the Marketplace */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            1
          </div>
          <h2 className="text-xl font-bold">{t("step1Title")}</h2>
        </div>
        <p className="text-muted-foreground">{t("step1Desc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("jurisdictionFilters")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("jurisdictionFiltersDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("skillCards")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("skillCardsDesc")}
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border border-border rounded-xl text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">{t("navigateTo")}</strong>
          </p>
          <code className="block mt-2 text-xs">
            https://your-instance.example.com/marketplace
          </code>
        </div>
      </div>

      {/* Step 2: Purchase a Skill */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            2
          </div>
          <h2 className="text-xl font-bold">{t("step2Title")}</h2>
        </div>
        <p className="text-muted-foreground">{t("step2Desc")}</p>

        <div className="border border-border p-6 rounded-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {t("secureCheckout")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("secureCheckoutDesc")}
              </p>
            </div>
            <div className="p-4 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {t("instantEntitlement")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("instantEntitlementDesc")}
              </p>
            </div>
            <div className="p-4 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {t("downloadReady")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("downloadReadyDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Download the Package */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            3
          </div>
          <h2 className="text-xl font-bold">{t("step3Title")}</h2>
        </div>
        <p className="text-muted-foreground">
          {t("step3Desc")}
        </p>

        {/* Package structure */}
        <div className="p-5 border border-border bg-card font-mono text-sm rounded-2xl">
          <p className="text-muted-foreground mb-2">
            founders-agreement-1.0.0.skill (ZIP archive)
          </p>
          <div className="space-y-1 pl-2 border-l-2 border-border ml-2">
            <p>
              <span className="text-primary">manifest.json</span>
              <span className="text-muted-foreground ml-4">
                {t("manifestComment")}
              </span>
            </p>
            <p>
              <span className="text-foreground">content/clauses.json</span>
              <span className="text-muted-foreground ml-4">
                {t("clausesComment")}
              </span>
            </p>
            <p>
              <span className="text-foreground">content/boilerplate.json</span>
              <span className="text-muted-foreground ml-4">
                {t("boilerplateComment")}
              </span>
            </p>
            <p>
              <span className="text-amber-400">signature.sig</span>
              <span className="text-muted-foreground ml-4">
                {t("signatureComment")}
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t("tamperProof")}</p>
            <p className="text-muted-foreground mt-1">
              {t("tamperProofDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Step 4: Install via CLI */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            4
          </div>
          <h2 className="text-xl font-bold">{t("step4Title")}</h2>
        </div>
        <p className="text-muted-foreground">{t("step4Desc")}</p>

        <div className="space-y-4">
          <div className="p-5 border border-border bg-card rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
              {t("verifyIntegrity")}
            </p>
            <code className="block font-mono text-sm">
              <span className="text-primary">npx</span> deal-room skill:verify
              ./founders-agreement-1.0.0.skill
            </code>
            <div className="mt-3 p-3 bg-muted/30 rounded-xl font-mono text-xs text-muted-foreground">
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("verifyManifest")}
              </p>
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("verifyFiles")}
              </p>
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("verifySignature")}
              </p>
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("verifyContent")}
              </p>
            </div>
          </div>

          <div className="p-5 border border-border bg-card rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
              {t("installToDb")}
            </p>
            <code className="block font-mono text-sm">
              <span className="text-primary">npx</span> deal-room skill:install
              ./founders-agreement-1.0.0.skill
            </code>
            <div className="mt-3 p-3 bg-muted/30 rounded-xl font-mono text-xs text-muted-foreground">
              <p>{t("installProgress")}</p>
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("installVerified")}
              </p>
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("installTemplate")}
              </p>
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("installClauses")}
              </p>
              <p>
                <span className="text-primary">&#10003;</span>{" "}
                {t("installReady")}
              </p>
            </div>
          </div>

          <div className="p-5 border border-border bg-card rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
              {t("listInstalled")}
            </p>
            <code className="block font-mono text-sm">
              <span className="text-primary">npx</span> deal-room skill:list
            </code>
          </div>
        </div>
      </div>

      {/* Step 5: License Activation */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-primary bg-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0">
            5
          </div>
          <h2 className="text-xl font-bold">{t("step5Title")}</h2>
        </div>
        <p className="text-muted-foreground">{t("step5Desc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Fingerprint className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("machineFingerprint")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("machineFingerprintDesc")}
            </p>
            <div className="p-3 bg-muted/30 rounded-xl">
              <code className="text-xs font-mono">
                <span className="text-primary">npx</span> deal-room
                license:fingerprint
              </code>
            </div>
          </div>

          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <KeyRound className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("activateLicense")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("activateLicenseDesc")}
            </p>
            <div className="p-3 bg-muted/30 rounded-xl">
              <code className="text-xs font-mono">
                <span className="text-primary">npx</span> deal-room
                skill:activate --key YOUR_LICENSE_KEY
              </code>
            </div>
          </div>
        </div>

        {/* Activation status indicators */}
        <div className="border border-border p-5 rounded-2xl">
          <p className="text-sm font-medium mb-3">{t("licenseStates")}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-medium w-20">{t("stateActive")}</span>
              <span className="text-muted-foreground">
                {t("stateActiveDesc")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-medium w-20">{t("stateTaster")}</span>
              <span className="text-muted-foreground">
                {t("stateTasterDesc")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span className="font-medium w-20">{t("stateExpired")}</span>
              <span className="text-muted-foreground">
                {t("stateExpiredDesc")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CLI Reference */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("cliReference")}</h2>
        <p className="text-muted-foreground">{t("cliReferenceDesc")}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 font-medium">
                  {t("cliCommand")}
                </th>
                <th className="text-left p-3 font-medium">
                  {t("cliDescription")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:list
                </td>
                <td className="p-3 text-muted-foreground">
                  {t("cmdSkillList")}
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:verify &lt;file&gt;
                </td>
                <td className="p-3 text-muted-foreground">
                  {t("cmdSkillVerify")}
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:install &lt;file&gt;
                </td>
                <td className="p-3 text-muted-foreground">
                  {t("cmdSkillInstall")}
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:activate --key &lt;key&gt;
                </td>
                <td className="p-3 text-muted-foreground">
                  {t("cmdSkillActivate")}
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  license:fingerprint
                </td>
                <td className="p-3 text-muted-foreground">
                  {t("cmdFingerprint")}
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  license:status
                </td>
                <td className="p-3 text-muted-foreground">
                  {t("cmdLicenseStatus")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("troubleshooting")}</h2>

        <div className="space-y-3">
          <div className="border border-border p-4 rounded-xl">
            <p className="font-medium text-sm mb-1">
              {t("troubleSignatureTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("troubleSignatureDesc")}
            </p>
          </div>

          <div className="border border-border p-4 rounded-xl">
            <p className="font-medium text-sm mb-1">
              {t("troubleEntitlementTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("troubleEntitlementDesc")}
            </p>
          </div>

          <div className="border border-border p-4 rounded-xl">
            <p className="font-medium text-sm mb-1">
              {t("troubleActivationTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("troubleActivationDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
