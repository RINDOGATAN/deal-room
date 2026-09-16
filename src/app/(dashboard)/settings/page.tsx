"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { PILOT_EXPORT_PATH, PILOT_RUN_URL } from "@/lib/pilot";
import { PilotCapMessage } from "@/components/pilot/PilotNotice";

export default function SettingsPage() {
  const t = useTranslations("pilot");
  const locale = useLocale();
  const { data, isLoading } = trpc.pilot.status.useQuery();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const endsAt = data.endsAt
    ? new Date(data.endsAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const dealsFull = data.deals.used >= data.deals.limit;
  const journeysFull = data.journeys.used >= data.journeys.limit;

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">{t("settingsTitle")}</h1>

      <section className="card-brutal p-6 space-y-4" data-testid="pilot-settings">
        <h2 className="text-lg font-semibold">{t("sectionTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("sectionIntro")}</p>

        <p className="text-base font-medium" data-testid="pilot-counter">
          {data.readOnly
            ? t("counterEnded", { used: data.deals.used, limit: data.deals.limit })
            : t("counter", {
                days: data.daysLeft ?? 0,
                used: data.deals.used,
                limit: data.deals.limit,
              })}
        </p>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>{t("journeys", { used: data.journeys.used, limit: data.journeys.limit })}</li>
          <li>
            {t("organisations", {
              used: data.organisations.used,
              limit: data.organisations.limit,
            })}
          </li>
        </ul>
        {!data.readOnly && endsAt && (
          <p className="text-sm text-muted-foreground">{t("editUntil", { date: endsAt })}</p>
        )}

        {data.readOnly && <PilotCapMessage reason="read_only" />}
        {!data.readOnly && dealsFull && <PilotCapMessage reason="deals" />}
        {!data.readOnly && journeysFull && <PilotCapMessage reason="journeys" />}

        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href={PILOT_EXPORT_PATH}
            className="btn-brutal text-sm px-4 py-2 inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t("exportButton")}
          </a>
          <a
            href={PILOT_RUN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 inline-flex items-center gap-2 rounded-full border border-border hover:bg-secondary transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t("runButton")}
          </a>
        </div>
      </section>
    </div>
  );
}
