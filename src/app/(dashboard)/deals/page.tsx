"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/date";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Users,
  Mail,
  Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { features } from "@/config/features";

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
  const locale = useLocale();
  const { data: deals, isLoading, error, refetch } = trpc.deal.list.useQuery();

  const resendInvitation = trpc.invitation.resend.useMutation({
    onSuccess: () => {
      toast.success(t("invitationResent"));
      refetch();
    },
    onError: (err) => toast.error(t("resendFailed", { error: err.message })),
  });

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
        <Link href="/deals/new" className="btn-brutal flex items-center gap-2 py-2 text-sm md:py-3 md:text-base">
          <Plus className="w-4 h-4" />
          {t("newDeal")}
        </Link>
      </div>

      {deals?.length === 0 ? (
        <div className="space-y-4">
          <div className="card-brutal text-center py-10">
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

          {features.startupJourney && locale !== "es" && (
            <Link
              href="/launch"
              className="card-brutal group hover:border-primary transition-colors flex items-center gap-4"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 flex items-center justify-center rounded-full">
                <Rocket className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold group-hover:text-primary group-active:text-primary group-focus-visible:text-primary transition-colors">
                  {t("startupLaunchTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("startupLaunchDescription")}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-active:text-primary group-focus-visible:text-primary transition-colors flex-shrink-0" />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {deals?.map((deal) => {
            const StatusIcon = statusIcons[deal.status];
            const statusColor = statusColors[deal.status];
            const statusLabel = statusLabels[deal.status];
            const initiator = deal.parties.find((p) => p.role === "INITIATOR");
            const respondent = deal.parties.find((p) => p.role === "RESPONDENT");

            const pendingInvitation = deal.status === "AWAITING_RESPONSE" ? deal.invitations?.[0] : undefined;
            // eslint-disable-next-line react-hooks/purity -- intentional wall-clock read for coarse "days waiting"/expiry labels; per-render staleness is acceptable
            const now = Date.now();
            const daysWaiting = pendingInvitation
              ? Math.floor((now - new Date(pendingInvitation.sentAt).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            const invitationExpired = pendingInvitation ? new Date(pendingInvitation.expiresAt).getTime() < now : false;
            const showResend = !!pendingInvitation && (invitationExpired || daysWaiting >= 7);
            const isResendingThis = resendInvitation.isPending && resendInvitation.variables?.invitationId === pendingInvitation?.id;

            return (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="card-brutal group hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* `min-w-0 flex-1` lets the inner `truncate` spans actually clip,
                      and stops the column from pushing the page wider than 375px. */}
                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Title + badge: wrap on narrow viewports — long deal names
                        or wider Spanish status labels ("Esperando respuesta") used
                        to push the row off-screen. */}
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                      <h2 className="text-lg font-semibold group-hover:text-primary group-active:text-primary group-focus-visible:text-primary transition-colors min-w-0 break-words">
                        {deal.name}
                      </h2>
                      <Badge className={`${statusColor} flex-shrink-0`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusLabel}
                      </Badge>
                    </div>

                    {/* Metadata row: wrap with gap instead of hard bullet
                        separators (which orphan onto wrapped lines anyway). */}
                    <div className="flex items-center gap-x-3 gap-y-1 text-sm text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{deal.contractTemplate.displayName}</span>
                      </span>
                      <span><span className="metric text-foreground">{deal._count.clauses}</span> {t("clauses")}</span>
                      <span>{t("updated", { date: formatDate(new Date(deal.updatedAt), { locale, governingLaw: deal.governingLaw }) })}</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 text-sm min-w-0 flex-wrap">
                      <span className="text-muted-foreground truncate min-w-0">
                        <span className="text-foreground">{initiator?.name || initiator?.email}</span>
                        {initiator?.company && ` (${initiator.company})`}
                      </span>
                      {respondent && (
                        <>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground truncate min-w-0">
                            <span className="text-foreground">{respondent.name || respondent.email}</span>
                            {respondent.company && ` (${respondent.company})`}
                          </span>
                        </>
                      )}
                    </div>

                    {pendingInvitation && (
                      <div className="flex items-center gap-x-3 gap-y-2 text-xs pt-1 flex-wrap">
                        <span
                          className={`flex items-center gap-1.5 ${
                            invitationExpired
                              ? "text-orange-500"
                              : daysWaiting >= 7
                                ? "text-yellow-600"
                                : "text-muted-foreground"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {invitationExpired ? t("invitationExpired") : t("waitingDays", { days: Math.max(daysWaiting, 0) })}
                        </span>
                        {showResend && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              resendInvitation.mutate({ invitationId: pendingInvitation.id });
                            }}
                            disabled={resendInvitation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-50 min-h-[36px]"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {isResendingThis ? "…" : t("resendInvitation")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-active:text-primary group-focus-visible:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
