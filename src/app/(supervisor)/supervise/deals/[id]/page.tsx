"use client";

import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  DRAFT: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  AWAITING_RESPONSE: { label: "Awaiting Response", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  NEGOTIATING: { label: "Negotiating", color: "bg-blue-500/20 text-blue-500", icon: Users },
  AGREED: { label: "Agreed", color: "bg-primary/20 text-primary", icon: CheckCircle },
  SIGNING: { label: "Signing", color: "bg-purple-500/20 text-purple-500", icon: FileText },
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
  const router = useRouter();
  const params = useParams();
  const dealId = params.id as string;

  const { data: deal, isLoading, error } = trpc.supervisor.getDealDetails.useQuery(
    { dealId },
    { enabled: !!dealId }
  );

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
          <Badge variant="outline" className="text-purple-500 border-purple-500">
            <Scale className="w-3 h-3 mr-1" />
            Supervisor View
          </Badge>
        </div>
      </div>

      {/* Deal Overview */}
      <div className="grid grid-cols-3 gap-6">
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
              <span className="font-medium">{format(new Date(deal.createdAt), "MMM d, yyyy")}</span>
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
              <span className="text-sm">{format(new Date(deal.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="text-sm">{format(new Date(deal.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            {initiator?.submittedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Party A Submitted</span>
                <span className="text-sm">{format(new Date(initiator.submittedAt), "MMM d, yyyy")}</span>
              </div>
            )}
            {respondent?.submittedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Party B Submitted</span>
                <span className="text-sm">{format(new Date(respondent.submittedAt), "MMM d, yyyy")}</span>
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
        <div className="border border-border">
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
                      <span className="text-purple-500">{latestSuggestion.suggestedOption.label}</span>
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

      {/* Audit Log */}
      <div className="card-brutal">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-purple-500" />
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
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p>
                    <span className="font-medium">{log.user?.name || log.user?.email || "System"}</span>
                    {" "}
                    <span className="text-muted-foreground">{log.action.replace(/_/g, " ").toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
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
