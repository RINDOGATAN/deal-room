"use client";

import { useTranslations } from "next-intl";
import {
  Scale,
  ClipboardCheck,
  FileCheck,
  Send,
  UserCheck,
  CheckCircle,
  MessageSquare,
  CreditCard,
  ArrowRight,
} from "lucide-react";

export default function VettingPage() {
  const t = useTranslations("vetting");

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* What is Vetting */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("whatIsTitle")}</h2>
        <p className="text-muted-foreground">{t("whatIsDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">{t("cardExpertGuidance")}</p>
            <p className="text-sm text-muted-foreground">
              {t("cardExpertGuidanceDesc")}
            </p>
          </div>
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">{t("cardTransparentNotes")}</p>
            <p className="text-sm text-muted-foreground">
              {t("cardTransparentNotesDesc")}
            </p>
          </div>
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">{t("cardClientControl")}</p>
            <p className="text-sm text-muted-foreground">
              {t("cardClientControlDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* The Vetting Process */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t("processTitle")}</h2>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-muted-foreground rounded-full flex-shrink-0">
                <span className="font-bold">1</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Scale className="w-5 h-5" />
                  <h3 className="text-lg font-bold">{t("step1Title")}</h3>
                  <span className="text-xs px-2 py-1 bg-muted text-muted-foreground border border-border rounded-full">
                    {t("step1Badge")}
                  </span>
                </div>
                <p className="text-muted-foreground">{t("step1Desc")}</p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-primary text-primary rounded-full flex-shrink-0">
                <span className="font-bold">2</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <ClipboardCheck className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-primary">
                    {t("step2Title")}
                  </h3>
                </div>
                <p className="text-muted-foreground mb-4">{t("step2Desc")}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <p className="font-medium">
                        {t("step2SelectsRecommended")}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t("step2SelectsRecommendedDesc")}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <p className="font-medium">{t("step2AddsNotes")}</p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t("step2AddsNotesDesc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-muted-foreground rounded-full flex-shrink-0">
                <span className="font-bold">3</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FileCheck className="w-5 h-5" />
                  <h3 className="text-lg font-bold">{t("step3Title")}</h3>
                </div>
                <p className="text-muted-foreground">{t("step3Desc")}</p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-muted-foreground rounded-full flex-shrink-0">
                <span className="font-bold">4</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Send className="w-5 h-5" />
                  <h3 className="text-lg font-bold">{t("step4Title")}</h3>
                </div>
                <p className="text-muted-foreground">{t("step4Desc")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Experience */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("clientExpTitle")}</h2>
        <p className="text-muted-foreground">{t("clientExpDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <UserCheck className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("clientPrePopulated")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("clientPrePopulatedDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("clientLawyerNotes")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("clientLawyerNotesDesc")}
            </p>
          </div>
        </div>

        <div className="border border-primary/30 p-5 bg-primary/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <ArrowRight className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-primary">{t("clientFullOverride")}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("clientFullOverrideDesc")}
          </p>
        </div>
      </div>

      {/* Subscription */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("subscriptionTitle")}</h2>
        <p className="text-muted-foreground">{t("subscriptionDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-2">
              {t("subscriptionFreeTitle")}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-medium">
                {t("subscriptionFreeBadge")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("subscriptionFreeDesc")}
            </p>
          </div>

          <div className="border border-primary p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-primary mb-2">
              {t("subscriptionPaidTitle")}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-medium">
                €9/month
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("subscriptionPaidDesc")}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("subscriptionPaidFeature1")}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("subscriptionPaidFeature2")}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{t("subscriptionPaidFeature3")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
