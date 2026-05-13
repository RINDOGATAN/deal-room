"use client";

import { Gift } from "lucide-react";
import { useTranslations } from "next-intl";
import { features } from "@/config/features";

/**
 * Promotional banner shown while every premium skill is free.
 * Renders nothing when `features.allSkillsFree` is off.
 */
export function PromoBanner() {
  const t = useTranslations("promo");
  if (!features.allSkillsFree) return null;

  return (
    <div className="card-brutal border-primary/40 bg-primary/5 flex items-start gap-3 py-3">
      <Gift className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t("allSkillsFreeTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("allSkillsFreeDescription")}
        </p>
      </div>
    </div>
  );
}
