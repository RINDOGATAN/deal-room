"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useTranslations, useLocale } from "next-intl";
import {
  Plus,
  ClipboardCheck,
  CheckCircle2,
  FileEdit,
  Send,
} from "lucide-react";
function resolveLocalized(
  localized: unknown,
  locale: string,
  fallback: string
): string {
  if (!localized || typeof localized !== "object") return fallback;
  const map = localized as Record<string, string>;
  return map[locale] || map["en"] || fallback;
}

export default function VettingsListPage() {
  const t = useTranslations("lawyer");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const { data: vettings, isLoading } = trpc.lawyer.listVettings.useQuery();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{t("myVettings")}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-brutal animate-pulse h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("myVettings")}</h1>
        </div>
        <Link
          href="/lawyer/vettings/new"
          className="btn-brutal flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          {t("vetNewTemplate")}
        </Link>
      </div>

      {!vettings?.length ? (
        <div className="card-brutal text-center py-12">
          <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("noVettingsYet")}</h2>
          <p className="text-muted-foreground mb-6">{t("createFirstVetting")}</p>
          <Link
            href="/lawyer/vettings/new"
            className="btn-brutal inline-flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            {t("vetNewTemplate")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vettings.map((vetting) => {
            const displayName = resolveLocalized(
              vetting.contractTemplate.displayNameLocalized,
              locale,
              vetting.contractTemplate.displayName
            );

            return (
              <Link
                key={vetting.id}
                href={`/lawyer/vettings/${vetting.id}`}
                className="card-brutal hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{displayName}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      vetting.status === "APPROVED"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {vetting.status === "APPROVED" ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("approved")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <FileEdit className="w-3 h-3" />
                        {t("draft")}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{vetting.governingLaw.replace("_", " & ")}</span>
                  <span>{t("clausesReviewed", { count: vetting._count.recommendations })}</span>
                  <span className="flex items-center gap-1">
                    <Send className="w-3 h-3" />
                    {t("invitesSent", { count: vetting._count.clientInvitations })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
