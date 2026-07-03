"use client";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUserRole } from "@/contexts/UserRoleContext";
import {
  Inbox,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

const statusIcons: Record<string, typeof Clock> = {
  PENDING: Clock,
  ACCEPTED: CheckCircle2,
  DECLINED: XCircle,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-600",
  ACCEPTED: "bg-primary/10 text-primary",
  DECLINED: "bg-destructive/10 text-destructive",
  COMPLETED: "bg-green-500/10 text-green-600",
  CANCELLED: "bg-muted text-muted-foreground",
};

const jurisdictionKeys: Record<string, string> = {
  CALIFORNIA: "jurisdictionCalifornia",
  ENGLAND_WALES: "jurisdictionEnglandWales",
  SPAIN: "jurisdictionSpain",
};

const sourceAppLabels: Record<string, string> = {
  "dpo-central": "DPO Central",
  "ai-sentinel": "AI Sentinel",
  "vendorwatch": "VendorWatch",
};

export default function RequestsPage() {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const { persona, isLoading: roleLoading } = useUserRole();

  const isLawyer = persona === "lawyer";

  const { data: incomingRequests, isLoading: loadingIncoming } =
    trpc.lawyer.listIncomingRequests.useQuery(undefined, { enabled: isLawyer });

  const { data: sentRequests, isLoading: loadingSent } =
    trpc.lawyer.listSentRequests.useQuery(undefined, { enabled: !isLawyer });

  const utils = trpc.useUtils();

  const respondMutation = trpc.lawyer.respondToRequest.useMutation({
    onSuccess: () => {
      utils.lawyer.listIncomingRequests.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = trpc.lawyer.cancelRequest.useMutation({
    onSuccess: () => {
      toast.success(t("cancelledToast"));
      utils.lawyer.listSentRequests.invalidate();
    },
    onError: (error) => {
      toast.error(t("cancelFailed", { error: error.message }));
    },
  });

  const handleRespond = (requestId: string, action: "ACCEPTED" | "DECLINED") => {
    respondMutation.mutate({ requestId, action });
  };

  const handleCancel = (requestId: string) => {
    if (!window.confirm(t("cancelConfirm"))) return;
    cancelMutation.mutate({ requestId });
  };

  if (roleLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="card-brutal animate-pulse h-32" />
      </div>
    );
  }

  const requests = isLawyer ? incomingRequests : sentRequests;
  const loading = isLawyer ? loadingIncoming : loadingSent;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">
          {isLawyer ? t("incoming") : t("sent")}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-brutal animate-pulse h-24" />
          ))}
        </div>
      ) : !requests?.length ? (
        <div className="card-brutal text-center py-12">
          {isLawyer ? (
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          ) : (
            <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          )}
          <h2 className="text-lg font-semibold mb-2">
            {isLawyer ? t("noIncoming") : t("noSent")}
          </h2>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const StatusIcon = statusIcons[request.status] || Clock;
            const person = isLawyer
              ? (request as NonNullable<typeof incomingRequests>[number]).requester
              : (request as NonNullable<typeof sentRequests>[number]).lawyer;
            const isExternal = !!request.externalRequesterName;

            return (
              <div key={request.id} className="card-brutal">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">
                        {request.contractType}
                      </h3>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[request.status]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {t(request.status.toLowerCase() as "pending" | "accepted" | "declined" | "completed" | "cancelled")}
                      </span>
                      {/* Expiry hint for live requests on either side. After
                          a request is COMPLETED/DECLINED/CANCELLED the expiry
                          stops mattering — don't add visual noise. */}
                      {(request.status === "PENDING" || request.status === "ACCEPTED") && (() => {
                        const now = Date.now();
                        const expires = new Date(request.expiresAt).getTime();
                        const daysUntilExpiry = Math.floor((expires - now) / 86_400_000);
                        const expired = daysUntilExpiry < 0;
                        const urgent = !expired && daysUntilExpiry <= 5;
                        if (!expired && !urgent) return null;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                              expired ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-600"
                            }`}
                          >
                            {expired
                              ? t("expired", { days: -daysUntilExpiry })
                              : t("expiresIn", { days: daysUntilExpiry })}
                          </span>
                        );
                      })()}
                      {(request as { sourceApp?: string | null }).sourceApp && (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600">
                          {sourceAppLabels[(request as { sourceApp: string }).sourceApp] || (request as { sourceApp: string }).sourceApp}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>
                        {isLawyer ? t("from") : t("to")}:{" "}
                        {isExternal
                          ? `${request.externalRequesterName}${request.externalRequesterCompany ? ` (${request.externalRequesterCompany})` : ""}`
                          : (person?.name || person?.email || "Unknown")}
                      </span>
                      {!isExternal && person?.company && <span>{person.company}</span>}
                      {request.sourceApp && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{request.sourceApp}</span>
                      )}
                      {request.governingLaw && (
                        <span>{tCommon(jurisdictionKeys[request.governingLaw] || request.governingLaw)}</span>
                      )}
                    </div>
                    {request.message && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        &ldquo;{request.message}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {isLawyer && request.status === "PENDING" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleRespond(request.id, "ACCEPTED")}
                        disabled={respondMutation.isPending}
                        className="btn-brutal text-xs px-3 py-1.5"
                      >
                        {respondMutation.isPending ? t("accepting") : t("accept")}
                      </button>
                      <button
                        onClick={() => handleRespond(request.id, "DECLINED")}
                        disabled={respondMutation.isPending}
                        className="px-3 py-1.5 text-xs border border-border rounded-full hover:bg-secondary transition-colors"
                      >
                        {respondMutation.isPending ? t("declining") : t("decline")}
                      </button>
                    </div>
                  )}
                  {!isLawyer && (request.status === "PENDING" || request.status === "ACCEPTED") && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      disabled={cancelMutation.isPending}
                      className="px-3 py-1.5 text-xs border border-border rounded-full hover:bg-secondary transition-colors shrink-0 disabled:opacity-40"
                    >
                      {cancelMutation.isPending ? t("cancelling") : t("cancel")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
