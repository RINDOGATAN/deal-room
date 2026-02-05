"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;
  const t = useTranslations("dealDetail");
  const tDeals = useTranslations("deals");
  const tCommon = useTranslations("common");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");

  const { data: deal, isLoading, error, refetch } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: progress } = trpc.deal.getProgress.useQuery({ id: dealId });

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
  const isInitiator = deal.currentUserRole === "INITIATOR";
  const canInvite = isInitiator && !respondent && deal.status === "DRAFT";
  const canNegotiate = deal.status === "DRAFT" || deal.status === "AWAITING_RESPONSE" || deal.status === "NEGOTIATING";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{deal.name}</h1>
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
            <span>Created {format(new Date(deal.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canNegotiate && (
            <Link
              href={`/deals/${deal.id}/negotiate`}
              className="btn-brutal flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              {isInitiator && initiator?.status === "PENDING" ? t("makeSelections") : t("continueNegotiation")}
            </Link>
          )}
          {deal.status === "NEGOTIATING" && (
            <Link
              href={`/deals/${deal.id}/review`}
              className="btn-brutal-outline flex items-center gap-2"
            >
              {t("reviewCompromises")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card-neutral">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("yourSelections")}</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="metric-lg text-foreground">{progress.initiatorProgress.completed}</span>
              <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
            </div>
            <Progress value={progress.initiatorProgress.percentage} className="h-1.5" />
          </div>
          <div className="stat-card-neutral">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("counterparty")}</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="metric-lg text-foreground">{progress.respondentProgress.completed}</span>
              <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
            </div>
            <Progress value={progress.respondentProgress.percentage} className="h-1.5" />
          </div>
          <div className="stat-card">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("agreedClauses")}</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="metric-lg text-primary">{progress.agreedClauses.completed}</span>
              <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
            </div>
            <Progress value={progress.agreedClauses.percentage} className="h-1.5 [&>div]:bg-primary" />
          </div>
        </div>
      )}

      {/* Parties */}
      <div className="grid grid-cols-2 gap-6">
        {/* Initiator */}
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("initiator")}</span>
            {isInitiator && <Badge variant="outline" className="text-xs">{tCommon("you")}</Badge>}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                {(initiator?.name || initiator?.email || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{initiator?.name || "—"}</p>
                <p className="text-sm text-muted-foreground">{initiator?.email}</p>
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

        {/* Respondent */}
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("counterparty")}</span>
            {!isInitiator && deal.currentUserRole === "RESPONDENT" && <Badge variant="outline" className="text-xs">{tCommon("you")}</Badge>}
          </div>
          {respondent ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                  {(respondent.name || respondent.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{respondent.name || "—"}</p>
                  <p className="text-sm text-muted-foreground">{respondent.email}</p>
                </div>
              </div>
              {respondent.company && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="w-4 h-4" />
                  {respondent.company}
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {respondent.status === "SUBMITTED" ? t("selectionsSubmitted") : respondent.userId ? t("acceptedPendingSelections") : t("invitationPending")}
              </Badge>
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
                {t("inviteCounterparty")}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("completeSelectionsFirst")}
            </p>
          )}
        </div>
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
    </div>
  );
}
