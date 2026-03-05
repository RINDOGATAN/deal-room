"use client";

/**
 * Analytics Panel — Layer 4: Analytics & Intelligence Dashboard
 *
 * Shows negotiation benchmarks and deal activity when the Cloud API is available.
 * Without API key: displays blurred teaser data with upgrade CTA.
 */

import { trpc } from "@/lib/trpc";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  Lock,
} from "lucide-react";
import { brand } from "@/config/brand";

// Fake teaser data shown when analytics are unavailable
const TEASER_DATA = {
  avgRounds: 3.2,
  avgDays: 4.7,
  avgSatisfaction: 78,
  totalDeals: 142,
  completionRate: 89,
};

export function AnalyticsPanel() {
  const t = useTranslations("analytics");
  const { data: availability } = trpc.analytics.isAvailable.useQuery();
  const { data: activity } = trpc.analytics.getDealActivity.useQuery(undefined, {
    enabled: !!availability?.available,
  });

  const isAvailable = !!availability?.available && !!activity;

  return (
    <div className="card-brutal relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-heading text-lg">{t("title")}</h3>
        </div>
        {!isAvailable && (
          <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {t("premium")}
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${!isAvailable ? "blur-[6px] select-none pointer-events-none" : ""}`}>
        <div className="text-center p-3 bg-secondary/30 rounded-lg">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {isAvailable ? activity.avgCompletionDays.toFixed(1) : TEASER_DATA.avgDays}
          </p>
          <p className="text-xs text-muted-foreground">{t("avgDays")}</p>
        </div>
        <div className="text-center p-3 bg-secondary/30 rounded-lg">
          <Target className="w-4 h-4 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {isAvailable
              ? `${Math.round((activity.completedDeals / Math.max(activity.totalDeals, 1)) * 100)}%`
              : `${TEASER_DATA.completionRate}%`}
          </p>
          <p className="text-xs text-muted-foreground">{t("completionRate")}</p>
        </div>
        <div className="text-center p-3 bg-secondary/30 rounded-lg">
          <BarChart3 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {isAvailable ? activity.totalDeals : TEASER_DATA.totalDeals}
          </p>
          <p className="text-xs text-muted-foreground">{t("totalDeals")}</p>
        </div>
        <div className="text-center p-3 bg-secondary/30 rounded-lg">
          <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {isAvailable ? activity.activeDeals : 12}
          </p>
          <p className="text-xs text-muted-foreground">{t("activeDeals")}</p>
        </div>
      </div>

      {/* Upgrade CTA overlay (when unavailable) */}
      {!isAvailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-[1px]">
          <div className="text-center px-6">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="font-semibold text-sm mb-1">{t("upgradeTitle")}</p>
            <p className="text-xs text-muted-foreground mb-3 max-w-[240px]">
              {t("upgradeDescription")}
            </p>
            <a
              href={`https://${brand.domain}/pricing`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-brutal text-xs py-1.5 px-4 inline-flex items-center gap-1.5"
            >
              {t("learnMore")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
