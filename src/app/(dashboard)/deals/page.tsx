"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusIcons = {
  DRAFT: FileText,
  AWAITING_RESPONSE: Clock,
  NEGOTIATING: Users,
  AGREED: CheckCircle,
  SIGNING: FileText,
  COMPLETED: CheckCircle,
  CANCELLED: AlertCircle,
};

const statusColors = {
  DRAFT: "bg-muted text-muted-foreground",
  AWAITING_RESPONSE: "bg-yellow-500/20 text-yellow-500",
  NEGOTIATING: "bg-blue-500/20 text-blue-500",
  AGREED: "bg-primary/20 text-primary",
  SIGNING: "bg-purple-500/20 text-purple-500",
  COMPLETED: "bg-green-500/20 text-green-500",
  CANCELLED: "bg-orange-500/20 text-orange-500",
};

export default function DealsPage() {
  const t = useTranslations("deals");
  const tCommon = useTranslations("common");
  const { data: deals, isLoading, error } = trpc.deal.list.useQuery();

  // Map status keys to translation keys
  const statusLabels: Record<string, string> = {
    DRAFT: t("status.draft"),
    AWAITING_RESPONSE: t("status.awaitingResponse"),
    NEGOTIATING: t("status.negotiating"),
    AGREED: t("status.agreed"),
    SIGNING: t("status.signing"),
    COMPLETED: t("status.completed"),
    CANCELLED: t("status.cancelled"),
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("myDeals")}</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-brutal animate-pulse">
              <div className="h-6 bg-muted w-1/3 mb-4"></div>
              <div className="h-4 bg-muted w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertCircle className="w-5 h-5" />
          <span>{t("failedToLoad", { error: error.message })}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("myDeals")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("manageNegotiations")}
          </p>
        </div>
        <Link href="/deals/new" className="btn-brutal flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t("newDeal")}
        </Link>
      </div>

      {deals?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("noDealsYet")}</h2>
          <p className="text-muted-foreground mb-6">
            {t("createFirstDeal")}
          </p>
          <Link href="/deals/new" className="btn-brutal inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t("createDealRoom")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {deals?.map((deal) => {
            const StatusIcon = statusIcons[deal.status];
            const statusColor = statusColors[deal.status];
            const statusLabel = statusLabels[deal.status];
            const initiator = deal.parties.find((p) => p.role === "INITIATOR");
            const respondent = deal.parties.find((p) => p.role === "RESPONDENT");

            return (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="card-brutal group hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {deal.name}
                      </h2>
                      <Badge className={statusColor}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusLabel}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {deal.contractTemplate.displayName}
                      </span>
                      <span>•</span>
                      <span><span className="metric text-foreground">{deal._count.clauses}</span> {t("clauses")}</span>
                      <span>•</span>
                      <span>{t("updated", { date: format(new Date(deal.updatedAt), "MMM d, yyyy") })}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        <span className="text-foreground">{initiator?.name || initiator?.email}</span>
                        {initiator?.company && ` (${initiator.company})`}
                      </span>
                      {respondent && (
                        <>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            <span className="text-foreground">{respondent.name || respondent.email}</span>
                            {respondent.company && ` (${respondent.company})`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
