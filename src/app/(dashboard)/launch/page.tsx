"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Rocket, FileText, Users, Scale, ArrowRight } from "lucide-react";

export default function LaunchLandingPage() {
  const t = useTranslations("launch.landing");
  const { data: journeys, isLoading } = trpc.journey.list.useQuery();

  const hasExisting = (journeys?.length ?? 0) > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-full">
          <Rocket className="w-3.5 h-3.5" />
          <span>{t("badge")}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold leading-tight">
          {t("headline")}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          {t("subheadline")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-brutal space-y-2">
          <FileText className="w-5 h-5 text-primary" />
          <p className="font-semibold">{t("card1Title")}</p>
          <p className="text-sm text-muted-foreground">{t("card1Body")}</p>
        </div>
        <div className="card-brutal space-y-2">
          <Users className="w-5 h-5 text-primary" />
          <p className="font-semibold">{t("card2Title")}</p>
          <p className="text-sm text-muted-foreground">{t("card2Body")}</p>
        </div>
        <div className="card-brutal space-y-2">
          <Scale className="w-5 h-5 text-primary" />
          <p className="font-semibold">{t("card3Title")}</p>
          <p className="text-sm text-muted-foreground">{t("card3Body")}</p>
        </div>
      </div>

      <div className="card-brutal bg-primary/5 border-primary/30 space-y-4">
        <h2 className="text-lg font-semibold">{t("ctaPanelTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("ctaPanelBody")}</p>
        <Link
          href="/launch/new"
          className="btn-brutal inline-flex items-center gap-2"
        >
          {t("ctaButton")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {!isLoading && hasExisting && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">{t("pickUp")}</h2>
          <div className="grid gap-3">
            {journeys!.map((j) => (
              <Link
                key={j.id}
                href={`/launch/${j.id}`}
                className="card-brutal group hover:border-primary transition-colors flex items-center justify-between"
              >
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold group-hover:text-primary transition-colors break-words">
                    {j.companyName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {j.state} {j.entityType.replace("_", "-")} &middot;{" "}
                    {j.founders.length === 1
                      ? t("founderCountOne")
                      : t("founderCountOther", { count: j.founders.length })}
                    {" · "}
                    {j._count.dealRooms === 1
                      ? t("documentCountOne")
                      : t("documentCountOther", { count: j._count.dealRooms })}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
