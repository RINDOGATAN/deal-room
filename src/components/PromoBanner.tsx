"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Gift } from "lucide-react";
import { useTranslations } from "next-intl";
import { features } from "@/config/features";

/**
 * Promotional banner shown while an explicit free-skills promo window is
 * open (`NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS=true`). Renders nothing
 * otherwise — in particular on self-hosted deployments, where "no
 * subscription needed during this period" would be nonsense: skills there
 * are installed, not subscribed to.
 */
export function PromoBanner() {
  const t = useTranslations("promo");
  if (!features.promoBanner) return null;

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
