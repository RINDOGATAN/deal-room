"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { trpc } from "@/lib/trpc";
import { formatDate, formatDateTime } from "@/lib/date";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  Scale,
  Activity,
  Loader2,
  Shield,
  UserCheck,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  DRAFT: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  AWAITING_RESPONSE: { label: "Awaiting Response", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  NEGOTIATING: { label: "Negotiating", color: "bg-blue-500/20 text-blue-500", icon: Users },
  AGREED: { label: "Agreed", color: "bg-primary/20 text-primary", icon: CheckCircle },
  SIGNING: { label: "Signing", color: "bg-primary/20 text-primary", icon: FileText },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-500", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-yellow-500/20 text-yellow-600", icon: AlertCircle },
};

const partyStatusConfig = {
  PENDING: { label: "Pending", color: "text-muted-foreground" },
  SUBMITTED: { label: "Submitted", color: "text-blue-500" },
  REVIEWING: { label: "Reviewing", color: "text-yellow-500" },
  ACCEPTED: { label: "Accepted", color: "text-primary" },
};

export default function SupervisorDealDetailPage() {
  const params = useParams();
  const dealId = params.id as string;

  const { data: deal, isLoading, error, refetch } = trpc.supervisor.getDealDetails.useQuery(
    { dealId },
    { enabled: !!dealId }
  );

  const approveReview = trpc.supervisor.approveReview.useMutation({
    onSuccess: () => {
      toast.success("Review approved successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve review: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/supervise" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
        <div className="card-brutal animate-pulse h-64"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/supervise" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Error</h1>
        </div>
        <div className="card-brutal border-yellow-500">
          <div className="flex items-center gap-3 text-yellow-600">
            <AlertCircle className="w-5 h-5" />
            <span>{error.message}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!deal) {
    return null;
  }

  const status = statusConfig[deal.status];
  const StatusIcon = status.icon;
  const initiator = deal.parties.find((p) => p.role === "INITIATOR");
  const respondent = deal.parties.find((p) => p.role === "RESPONDENT");

  // Calculate clause stats
  const agreedClauses = deal.clauses.filter((c) => c.status === "AGREED").length;
  const totalClauses = deal.clauses.length;

  // Find if this supervisor is reviewing for a party (Stage A — Party Counsel)
  const reviewParty = deal.parties.find(
    (p) => p.attorneyReviewRequested && p.attorneySupervisorId
  );
  const hasReviewAssignment = reviewParty && !reviewParty.attorneyReviewApprovedAt;
  const reviewApproved = reviewParty?.attorneyReviewApprovedAt;

  // Stage B — Joint Closing Counsel
  const jointCounsel = deal.jointCounselSupervisor;
  const isJointCounsel = !!jointCounsel;
  const jointCounselAcknowledged = !!deal.jointCounselAcknowledgedAt;
  const jointCounselPending = !!deal.jointCounselRequestedAt && !jointCounselAcknowledged && !deal.jointCounselDeclinedAt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/supervise" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{deal.name}</h1>
            <p className="text-muted-foreground">{deal.contractTemplate.displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={status.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </Badge>
          <Badge variant="outline" className="text-primary border-primary">
            <Scale className="w-3 h-3 mr-1" />
            Supervisor View
          </Badge>
        </div>
      </div>

      {/* Stage A — Attorney Review Banner */}
      {hasReviewAssignment && reviewParty && (
        <div className="card-brutal border-primary/50 bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Party Counsel Review Requested</h2>
                <p className="text-sm text-muted-foreground">
                  You are reviewing this contract for{" "}
                  <span className="font-medium text-foreground">
                    {reviewParty.name || reviewParty.email}
                  </span>
                  {reviewParty.company && (
                    <> ({reviewParty.company})</>
                  )}
                  .
                  {reviewParty.attorneyReviewRequestedAt && (
                    <> Requested on {formatDate(new Date(reviewParty.attorneyReviewRequestedAt), { governingLaw: deal.governingLaw })}.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
              <a
                href={`/api/supervise/deals/${dealId}/document/docx`}
                className="btn-brutal-outline inline-flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download DOCX
              </a>
              <a
                href={`/api/supervise/deals/${dealId}/document`}
                className="btn-brutal-outline inline-flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
              <a
                href={`/api/supervise/deals/${dealId}/document/txt`}
                className="btn-brutal-outline inline-flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download TXT
              </a>
              <button
                onClick={() => approveReview.mutate({ dealRoomId: dealId })}
                disabled={approveReview.isPending}
                className="btn-brutal flex items-center gap-2"
              >
                {approveReview.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Approve Review
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage A — Review Approved Banner */}
      {reviewApproved && reviewParty && (
        <div className="card-brutal border-primary bg-primary/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/20 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Party Counsel Review Approved</h2>
              <p className="text-sm text-muted-foreground">
                You approved the contract review for{" "}
                <span className="font-medium text-foreground">
                  {reviewParty.name || reviewParty.email}
                </span>
                {" "}on {formatDate(new Date(reviewApproved), { governingLaw: deal.governingLaw })}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stage B — Joint Closing Counsel Banner */}
      {isJointCounsel && jointCounselPending && (
        <div className="card-brutal border-blue-500/50 bg-blue-500/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Scale className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Joint Closing Counsel</h2>
              <p className="text-sm text-muted-foreground">
                You have been requested as joint closing counsel for this deal.
                Both parties&apos; details are shown below. Waiting for the other party to acknowledge.
              </p>
            </div>
          </div>
        </div>
      )}

      {isJointCounsel && jointCounselAcknowledged && (
        <div className="card-brutal border-primary bg-primary/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Joint Closing Counsel — Active</h2>
              <p className="text-sm text-muted-foreground">
                Both parties have acknowledged your role as joint closing counsel.
                Review both parties&apos; positions below to help finalize the agreement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deal Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Parties */}
        <div className="card-brutal">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Parties
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 flex items-center justify-center text-primary font-semibold">
                {(initiator?.name || initiator?.email || "A")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{initiator?.name || "Party A"}</p>
                <p className="text-sm text-muted-foreground">{initiator?.email}</p>
                <p className={`text-xs ${partyStatusConfig[initiator?.status || "PENDING"].color}`}>
                  {partyStatusConfig[initiator?.status || "PENDING"].label}
                </p>
              </div>
            </div>
            {respondent && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 flex items-center justify-center text-blue-500 font-semibold">
                  {(respondent.name || respondent.email || "B")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{respondent.name || "Party B"}</p>
                  <p className="text-sm text-muted-foreground">{respondent.email}</p>
                  <p className={`text-xs ${partyStatusConfig[respondent.status].color}`}>
                    {partyStatusConfig[respondent.status].label}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="card-brutal">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Negotiation Progress
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agreed Clauses</span>
              <span className="font-medium text-primary">{agreedClauses}/{totalClauses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Round</span>
              <span className="font-medium">{deal.currentRound}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Governing Law</span>
              <span className="font-medium">{deal.governingLaw.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{formatDate(new Date(deal.createdAt), { governingLaw: deal.governingLaw })}</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="card-brutal">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Key Dates
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-sm">{formatDateTime(new Date(deal.createdAt), { governingLaw: deal.governingLaw })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="text-sm">{formatDateTime(new Date(deal.updatedAt), { governingLaw: deal.governingLaw })}</span>
            </div>
            {initiator?.submittedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Party A Submitted</span>
                <span className="text-sm">{formatDate(new Date(initiator.submittedAt), { governingLaw: deal.governingLaw })}</span>
              </div>
            )}
            {respondent?.submittedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Party B Submitted</span>
                <span className="text-sm">{formatDate(new Date(respondent.submittedAt), { governingLaw: deal.governingLaw })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clause-by-Clause Breakdown */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Clause-by-Clause Breakdown
        </h3>
        <div className="border border-border overflow-x-auto">
          <div className="min-w-[800px]">
          <div className="grid grid-cols-5 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
            <div>Clause</div>
            <div>Party A Selection</div>
            <div>Party B Selection</div>
            <div>Compromise</div>
            <div>Status</div>
          </div>
          {deal.clauses.map((clause) => {
            const partyASelection = clause.selections.find(
              (s) => s.partyId === initiator?.id
            );
            const partyBSelection = clause.selections.find(
              (s) => s.partyId === respondent?.id
            );
            const latestSuggestion = clause.compromiseSuggestions[0];
            const sameSelection = partyASelection?.optionId === partyBSelection?.optionId;

            return (
              <div
                key={clause.id}
                className="grid grid-cols-5 gap-4 p-3 border-t border-border text-sm"
              >
                <div>
                  <p className="font-medium">{clause.clauseTemplate.title}</p>
                  <p className="text-xs text-muted-foreground">{clause.clauseTemplate.category}</p>
                </div>
                <div>
                  {partyASelection ? (
                    <div>
                      <span className="text-primary">{partyASelection.option.label}</span>
                      <p className="text-xs text-muted-foreground">
                        Priority: {partyASelection.priority}/5 | Flex: {partyASelection.flexibility}/5
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Not selected</span>
                  )}
                </div>
                <div>
                  {partyBSelection ? (
                    <div>
                      <span className={sameSelection ? "text-primary" : "text-blue-500"}>
                        {partyBSelection.option.label}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Priority: {partyBSelection.priority}/5 | Flex: {partyBSelection.flexibility}/5
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Not selected</span>
                  )}
                </div>
                <div>
                  {latestSuggestion ? (
                    <div>
                      <span className="text-primary">{latestSuggestion.suggestedOption.label}</span>
                      <p className="text-xs text-muted-foreground">
                        A: {latestSuggestion.satisfactionPartyA.toFixed(0)}% |
                        B: {latestSuggestion.satisfactionPartyB.toFixed(0)}%
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">-</span>
                  )}
                </div>
                <div>
                  {clause.status === "AGREED" ? (
                    <Badge className="bg-primary/20 text-primary text-xs">Agreed</Badge>
                  ) : clause.status === "SUGGESTED" ? (
                    <Badge className="bg-blue-500/20 text-blue-500 text-xs">Suggested</Badge>
                  ) : partyASelection && partyBSelection && !sameSelection ? (
                    <Badge className="bg-yellow-500/20 text-yellow-500 text-xs">Divergent</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Pending</Badge>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="card-brutal">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Activity Log
          </h3>
        </div>
        {deal.auditLogs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {deal.auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p>
                    <span className="font-medium">{log.user?.name || log.user?.email || "System"}</span>
                    {" "}
                    <span className="text-muted-foreground">{log.action.replace(/_/g, " ").toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(log.createdAt), { governingLaw: deal.governingLaw })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
