"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { NextIntlClientProvider, useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/date";
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Users,
  Mail,
  Building,
  Edit,
  X,
  Send,
  ExternalLink,
  Download,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LawyerWarningModal } from "@/components/LawyerWarningModal";
import { VettingBadge } from "@/components/VettingBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

function DownloadLinks({ dealId, className }: { dealId: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      <Download className="w-3.5 h-3.5 flex-shrink-0" />
      <a href={`/api/deals/${dealId}/document`} className="hover:text-foreground underline underline-offset-2">PDF</a>
      <span aria-hidden>·</span>
      <a href={`/api/deals/${dealId}/document/docx`} className="hover:text-foreground underline underline-offset-2">DOCX</a>
      <span aria-hidden>·</span>
      <a href={`/api/deals/${dealId}/document/txt`} className="hover:text-foreground underline underline-offset-2">TXT</a>
    </div>
  );
}

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

/** Outer wrapper: determines contract language and provides correct locale */
export default function DealDetailPage() {
  const params = useParams();
  const dealId = params.id as string;
  const { data: deal } = trpc.deal.getById.useQuery({ id: dealId });
  const contractLang = (deal as any)?.contractLanguage || "en";
  const messages = contractLang === "es" ? esMessages : enMessages;

  return (
    <NextIntlClientProvider locale={contractLang} messages={messages}>
      <DealDetailContent dealId={dealId} />
    </NextIntlClientProvider>
  );
}

/** Inner component: all UI and hooks, picks up contract locale from provider */
function DealDetailContent({ dealId }: { dealId: string }) {
  const router = useRouter();
  const t = useTranslations("dealDetail");
  const tDeals = useTranslations("deals");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const { data: session } = useSession();
  const isLawyer = session?.user?.role === "LAWYER";

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");

  const { data: deal, isLoading, error, refetch } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: progress } = trpc.deal.getProgress.useQuery({ id: dealId });
  const { data: signingRequest } = trpc.signing.getRequest.useQuery({ dealRoomId: dealId });

  // Map status keys to translation keys
  const statusLabels: Record<string, string> = {
    DRAFT: tDeals("status.draft"),
    AWAITING_RESPONSE: tDeals("status.awaitingResponse"),
    NEGOTIATING: tDeals("status.negotiating"),
    AGREED: tDeals("status.agreed"),
    SIGNING: tDeals("status.signing"),
    COMPLETED: tDeals("status.completed"),
    CANCELLED: tDeals("status.cancelled"),
  };

  const sendInvite = trpc.invitation.send.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.invitationSent"));
      setInviteOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(t("toastMessages.invitationFailed", { error: error.message }));
    },
  });

  const { data: pendingInvitation } = trpc.invitation.getPendingForDeal.useQuery(
    { dealRoomId: dealId },
    {
      // Only worth fetching when the deal is plausibly waiting on the
      // respondent and the current user is the initiator who can resend.
      enabled:
        !!deal &&
        deal.status === "AWAITING_RESPONSE" &&
        deal.currentUserRole === "INITIATOR",
    },
  );

  const resendInvite = trpc.invitation.resend.useMutation({
    onSuccess: () => toast.success(t("toastMessages.invitationResent")),
    onError: (error) =>
      toast.error(t("toastMessages.invitationResendFailed", { error: error.message })),
  });

  const cancelDeal = trpc.deal.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.dealCancelled"));
      router.push("/deals");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card-brutal animate-pulse h-32"></div>
        <div className="card-brutal animate-pulse h-64"></div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertCircle className="w-5 h-5" />
          <span>{tDeals("failedToLoad", { error: error?.message || "Not found" })}</span>
        </div>
      </div>
    );
  }

  const StatusIcon = statusIcons[deal.status];
  const statusColor = statusColors[deal.status];
  const statusLabel = statusLabels[deal.status];
  const initiator = deal.parties.find((p) => p.role === "INITIATOR");
  const respondent = deal.parties.find((p) => p.role === "RESPONDENT");
  const isSoloMode = (deal as any).dealMode === "SOLO";
  const isInitiator = deal.currentUserRole === "INITIATOR";
  const canInvite = !isSoloMode && isInitiator && !respondent && deal.status === "DRAFT";
  const canNegotiate = deal.status === "DRAFT" || deal.status === "AWAITING_RESPONSE" || deal.status === "NEGOTIATING";

  // Lawyer warning modal — hidden for users with LAWYER role, users with a
  // vetting already attached, and for deals generated from the /launch journey
  // (that flow has its own lawyer-review surface at the journey level, so
  // repeating the disclaimer per document is just noise).
  const myParty = deal.parties.find((p) => p.id === deal.currentPartyId);
  const journeyGenerated = !!(deal as any).journeyId;
  const showLawyerWarning = !isLawyer &&
    !deal.lawyerVettingId &&
    !journeyGenerated &&
    !(myParty as any)?.lawyerWarningDismissedAt &&
    ["DRAFT", "AWAITING_RESPONSE", "NEGOTIATING"].includes(deal.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{deal.name}</h1>
            <Badge className={statusColor}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusLabel}
            </Badge>
            {(deal.status === "SIGNING" || deal.status === "COMPLETED") && signingRequest && (
              signingRequest.ceremonyId ? (
                <Badge className="bg-green-500/20 text-green-600">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {t("certifiedDocument")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <ShieldAlert className="w-3 h-3 mr-1" />
                  {t("uncertifiedDocument")}
                </Badge>
              )
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {deal.contractTemplate.displayName}
            </span>
            <span>•</span>
            <span>Created {formatDate(new Date(deal.createdAt), { locale, governingLaw: deal.governingLaw })}</span>
          </div>
          {(deal as any).lawyerVetting && (
            <VettingBadge vetting={(deal as any).lawyerVetting} governingLaw={deal.governingLaw} />
          )}
          {deal.status === "SIGNING" && signingRequest && (() => {
            const now = Date.now();
            const created = new Date(signingRequest.createdAt).getTime();
            const expires = new Date(signingRequest.expiresAt).getTime();
            const daysSinceStart = Math.max(0, Math.floor((now - created) / 86_400_000));
            const daysUntilExpiry = Math.floor((expires - now) / 86_400_000);
            const expired = daysUntilExpiry < 0;
            const urgent = !expired && daysUntilExpiry <= 3;
            return (
              <div className={`flex items-center gap-2 text-xs ${urgent || expired ? "text-destructive" : "text-muted-foreground"}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{t("signingInitiatedAgo", { days: daysSinceStart })}</span>
                <span>·</span>
                <span>
                  {expired
                    ? t("signingExpired", { days: -daysUntilExpiry })
                    : t("signingExpiresIn", { days: daysUntilExpiry })}
                </span>
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-3">
          {canNegotiate && (
            <Link
              href={`/deals/${deal.id}/negotiate`}
              className="btn-brutal flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isSoloMode
                  ? (isInitiator && initiator?.status === "PENDING" ? t("makeSelections") : t("continueNegotiation"))
                  : (isInitiator && initiator?.status === "PENDING" ? t("makeSelections") : t("continueNegotiation"))}
              </span>
            </Link>
          )}
          {!isSoloMode && deal.status === "NEGOTIATING" && (
            <Link
              href={`/deals/${deal.id}/review`}
              className="btn-brutal-outline flex items-center gap-2"
            >
              <span className="hidden sm:inline">{t("reviewCompromises")}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {isSoloMode && deal.status === "AGREED" && (
            <DownloadLinks dealId={deal.id} />
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className={`grid grid-cols-1 ${isSoloMode ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4`}>
          <div className="stat-card-neutral">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("yourSelections")}</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="metric-lg text-foreground">{progress.initiatorProgress.completed}</span>
              <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
            </div>
            <Progress value={progress.initiatorProgress.percentage} className="h-1.5" />
          </div>
          {!isSoloMode && (
            <div className="stat-card-neutral">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("counterparty")}</p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="metric-lg text-foreground">{progress.respondentProgress.completed}</span>
                <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
              </div>
              <Progress value={progress.respondentProgress.percentage} className="h-1.5" />
            </div>
          )}
          <div className="stat-card">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{isSoloMode ? t("soloConfirmedClauses") : t("agreedClauses")}</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="metric-lg text-primary">{progress.agreedClauses.completed}</span>
              <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
            </div>
            <Progress value={progress.agreedClauses.percentage} className="h-1.5 [&>div]:bg-primary" />
          </div>
        </div>
      )}

      {/* Parties */}
      <div className={`grid grid-cols-1 ${isSoloMode ? "" : "md:grid-cols-2"} gap-6`}>
        {/* Initiator */}
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("initiator")}</span>
            {isInitiator && <Badge variant="outline" className="text-xs">{tCommon("you")}</Badge>}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                {(initiator?.name || initiator?.email || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{initiator?.name || "—"}</p>
                <p className="text-sm text-muted-foreground truncate hidden md:block">{initiator?.email}</p>
              </div>
            </div>
            {initiator?.company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="w-4 h-4" />
                {initiator.company}
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              {initiator?.status === "SUBMITTED" ? t("selectionsSubmitted") : tCommon("pending")}
            </Badge>
          </div>
        </div>

        {/* Respondent (hidden in solo mode) */}
        {!isSoloMode && <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("counterparty")}</span>
            {!isInitiator && deal.currentUserRole === "RESPONDENT" && <Badge variant="outline" className="text-xs">{tCommon("you")}</Badge>}
          </div>
          {respondent ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-muted flex items-center justify-center text-muted-foreground font-semibold flex-shrink-0">
                  {(respondent.name || respondent.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{respondent.name || "—"}</p>
                  <p className="text-sm text-muted-foreground truncate hidden md:block">{respondent.email}</p>
                </div>
              </div>
              {respondent.company && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="w-4 h-4" />
                  {respondent.company}
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {respondent.status === "SUBMITTED" ? (
                  <><CheckCircle className="w-3 h-3 mr-1 inline" />{t("selectionsSubmitted")}</>
                ) : respondent.userId ? (
                  <><Clock className="w-3 h-3 mr-1 inline" /><span className="hidden sm:inline">{t("acceptedPendingSelections")}</span><span className="sm:hidden">{tCommon("pending")}</span></>
                ) : (
                  <><Mail className="w-3 h-3 mr-1 inline" /><span className="hidden sm:inline">{t("invitationPending")}</span><span className="sm:hidden">{tCommon("pending")}</span></>
                )}
              </Badge>
              {/* Resend invitation: only meaningful while waiting on the
                  respondent. The query is gated on deal.status above so
                  pendingInvitation is null in every other case. */}
              {!respondent.userId && pendingInvitation && isInitiator && (
                <button
                  onClick={() =>
                    resendInvite.mutate({ invitationId: pendingInvitation.id })
                  }
                  disabled={resendInvite.isPending}
                  className="btn-brutal-outline flex items-center gap-2 w-full justify-center text-sm disabled:opacity-40"
                >
                  <Mail className="w-4 h-4" />
                  {resendInvite.isPending ? t("resending") : t("resendInvitation")}
                </button>
              )}
            </div>
          ) : canInvite ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("noCounterpartyInvited")}
              </p>
              <button
                onClick={() => setInviteOpen(true)}
                className="btn-brutal-outline flex items-center gap-2 w-full justify-center"
              >
                <Mail className="w-4 h-4" />
                <span className="md:hidden">{t("invite")}</span>
                <span className="hidden md:inline">{t("inviteCounterparty")}</span>
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("completeSelectionsFirst")}
            </p>
          )}
        </div>}
      </div>

      {/* Clauses Summary */}
      <div className="card-brutal">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="font-semibold">{tDeals("clauses")}</h2>
          <span className="metric text-primary">{deal.clauses.length}</span>
        </div>
        <div className="-mx-6">
          {deal.clauses.map((clause, index) => {
            const clauseStatus = clause.status;
            const mySelection = clause.selections.find(
              (s) => s.partyId === deal.currentPartyId
            );

            return (
              <div
                key={clause.id}
                className="stat-row px-6"
              >
                <div className="flex items-center gap-4">
                  <span className="metric text-muted-foreground w-6 text-right">{index + 1}</span>
                  <div className={`w-2 h-2 ${
                    clauseStatus === "AGREED" ? "bg-primary" :
                    clauseStatus === "SUGGESTED" ? "bg-blue-500" :
                    clauseStatus === "DIVERGENT" ? "bg-yellow-500" :
                    "bg-muted-foreground/30"
                  }`} />
                  <div>
                    <p className="font-medium">{clause.clauseTemplate.title}</p>
                    <p className="text-xs text-muted-foreground">{clause.clauseTemplate.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  {mySelection ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground">{mySelection.option.label}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/50">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {deal.status !== "COMPLETED" && deal.status !== "CANCELLED" && (
        <div className="flex justify-end">
          <button
            onClick={() => cancelDeal.mutate({ id: deal.id })}
            className="flex items-center gap-2 px-4 py-2 text-sm text-orange-500 hover:bg-orange-500/10 transition-colors"
          >
            <X className="w-4 h-4" />
            {t("cancelDeal")}
          </button>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("inviteDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("inviteDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">{t("inviteDialog.emailAddress")} *</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("inviteDialog.emailPlaceholder")}
                className="input-brutal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteName">{t("inviteDialog.contactName")}</Label>
              <Input
                id="inviteName"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={t("inviteDialog.contactNamePlaceholder")}
                className="input-brutal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteCompany">{t("inviteDialog.company")}</Label>
              <Input
                id="inviteCompany"
                value={inviteCompany}
                onChange={(e) => setInviteCompany(e.target.value)}
                placeholder={t("inviteDialog.companyPlaceholder")}
                className="input-brutal"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setInviteOpen(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {tCommon("cancel")}
            </button>
            <button
              onClick={() => {
                if (!inviteEmail.trim()) {
                  toast.error(t("inviteDialog.emailRequired"));
                  return;
                }
                sendInvite.mutate({
                  dealRoomId: deal.id,
                  email: inviteEmail.trim(),
                  name: inviteName.trim() || undefined,
                  company: inviteCompany.trim() || undefined,
                });
              }}
              disabled={sendInvite.isPending}
              className="btn-brutal flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sendInvite.isPending ? t("inviteDialog.sending") : t("inviteDialog.sendInvitation")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lawyer Warning Modal */}
      {showLawyerWarning && (
        <LawyerWarningModal
          dealRoomId={deal.id}
          open={showLawyerWarning}
          onDismiss={() => refetch()}
        />
      )}
    </div>
  );
}
