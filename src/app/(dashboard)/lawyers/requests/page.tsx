"use client";

import Link from "next/link";
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
  ArrowRight,
  Plus,
} from "lucide-react";

const statusIcons: Record<string, typeof Clock> = {
  PENDING: Clock,
  ACCEPTED: CheckCircle2,
  DECLINED: XCircle,
  COMPLETED: CheckCircle2,
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-600",
  ACCEPTED: "bg-primary/10 text-primary",
  DECLINED: "bg-destructive/10 text-destructive",
  COMPLETED: "bg-green-500/10 text-green-600",
};

const jurisdictionKeys: Record<string, string> = {
  CALIFORNIA: "jurisdictionCalifornia",
  ENGLAND_WALES: "jurisdictionEnglandWales",
  SPAIN: "jurisdictionSpain",
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

  const handleRespond = (requestId: string, action: "ACCEPTED" | "DECLINED") => {
    respondMutation.mutate({ requestId, action });
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
          {!isLawyer && (
            <Link
              href="/lawyers"
              className="btn-brutal inline-flex items-center gap-2 text-sm mt-4"
            >
              {t("title")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const StatusIcon = statusIcons[request.status] || Clock;
            const person = isLawyer
              ? (request as NonNullable<typeof incomingRequests>[number]).requester
              : (request as NonNullable<typeof sentRequests>[number]).lawyer;

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
                        {t(request.status.toLowerCase() as "pending" | "accepted" | "declined" | "completed")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>{isLawyer ? t("from") : t("to")}: {person.name || person.email}</span>
                      {person.company && <span>{person.company}</span>}
                      <span>{tCommon(jurisdictionKeys[request.governingLaw] || request.governingLaw)}</span>
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
                  {isLawyer && request.status === "ACCEPTED" && (
                    <Link
                      href={`/lawyer/vettings/new?requestId=${request.id}&contractType=${request.contractType}&governingLaw=${request.governingLaw}`}
                      className="btn-brutal text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      {t("createVetting")}
                    </Link>
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
