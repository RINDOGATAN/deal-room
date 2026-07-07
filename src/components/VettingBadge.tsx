"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { ShieldCheck, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/date";

export interface VettingBadgeData {
  id: string;
  status: "DRAFT" | "APPROVED" | string;
  approvedAt: Date | string | null;
  lawyer: {
    name: string | null;
    email: string | null;
  };
}

export function VettingBadge({
  vetting,
  governingLaw,
  compact = false,
}: {
  vetting: VettingBadgeData | null | undefined;
  governingLaw?: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("vettingBadge");
  const locale = useLocale();
  if (!vetting) return null;

  const approved = vetting.status === "APPROVED";
  const lawyerName = vetting.lawyer.name || vetting.lawyer.email || "";
  const dateStr = vetting.approvedAt
    ? formatDate(new Date(vetting.approvedAt), { locale, governingLaw: governingLaw ?? undefined })
    : null;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 border ${approved ? "border-primary/40 text-primary bg-primary/5" : "border-border text-muted-foreground"}`}
        title={approved ? t("approvedTooltip", { lawyer: lawyerName, date: dateStr ?? "" }) : t("draftTooltip", { lawyer: lawyerName })}
      >
        {approved ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        <span>{approved ? t("vettedBy", { lawyer: lawyerName }) : t("draftBy", { lawyer: lawyerName })}</span>
      </span>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 p-3 border ${approved ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}
    >
      {approved ? (
        <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      ) : (
        <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {approved ? t("vettedBy", { lawyer: lawyerName }) : t("draftBy", { lawyer: lawyerName })}
        </p>
        <p className="text-xs text-muted-foreground">
          {approved && dateStr ? t("approvedOn", { date: dateStr }) : t("draftDescription")}
        </p>
      </div>
    </div>
  );
}
