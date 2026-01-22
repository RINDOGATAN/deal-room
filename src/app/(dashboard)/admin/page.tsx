"use client";

import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import Link from "next/link";
import {
  FileText,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Scale,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

const statusConfig = {
  DRAFT: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  AWAITING_RESPONSE: { label: "Awaiting Response", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  NEGOTIATING: { label: "Negotiating", color: "bg-blue-500/20 text-blue-500", icon: Users },
  AGREED: { label: "Agreed", color: "bg-primary/20 text-primary", icon: CheckCircle },
  SIGNING: { label: "Signing", color: "bg-purple-500/20 text-purple-500", icon: FileText },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-500", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-destructive/20 text-destructive", icon: AlertCircle },
};

const partyStatusConfig = {
  PENDING: { label: "Pending", color: "text-muted-foreground" },
  SUBMITTED: { label: "Submitted", color: "text-blue-500" },
  REVIEWING: { label: "Reviewing", color: "text-yellow-500" },
  ACCEPTED: { label: "Accepted", color: "text-primary" },
};

export default function AdminDashboard() {
  const { data: deals, isLoading, error } = trpc.admin.getAllDeals.useQuery();
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-brutal animate-pulse h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brutal border-destructive">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load deals: {error.message}</span>
        </div>
      </div>
    );
  }

  // Calculate summary stats
  const stats = {
    total: deals?.length || 0,
    draft: deals?.filter((d) => d.status === "DRAFT").length || 0,
    negotiating: deals?.filter((d) => d.status === "NEGOTIATING").length || 0,
    agreed: deals?.filter((d) => d.status === "AGREED" || d.status === "SIGNING" || d.status === "COMPLETED").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Supervising Attorney View - Monitor all negotiations
          </p>
        </div>
        <Badge variant="outline" className="text-purple-500 border-purple-500">
          <Scale className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total Deals</p>
        </div>
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold text-muted-foreground">{stats.draft}</p>
          <p className="text-sm text-muted-foreground">Drafts</p>
        </div>
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold text-blue-500">{stats.negotiating}</p>
          <p className="text-sm text-muted-foreground">Negotiating</p>
        </div>
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold text-primary">{stats.agreed}</p>
          <p className="text-sm text-muted-foreground">Agreed/Complete</p>
        </div>
      </div>

      {/* Deals List */}
      {deals?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No deals yet</h2>
          <p className="text-muted-foreground">
            Deals will appear here once created by users.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {deals?.map((deal) => {
            const status = statusConfig[deal.status];
            const StatusIcon = status.icon;
            const isExpanded = expandedDeal === deal.id;
            const initiator = deal.parties.find((p) => p.role === "INITIATOR");
            const respondent = deal.parties.find((p) => p.role === "RESPONDENT");

            // Calculate clause progress
            const agreedClauses = deal.clauses.filter((c) => c.status === "AGREED").length;
            const suggestedClauses = deal.clauses.filter((c) => c.status === "SUGGESTED").length;
            const divergentClauses = deal.clauses.filter((c) => c.status === "DIVERGENT").length;
            const totalClauses = deal.clauses.length;

            return (
              <div key={deal.id} className="card-brutal">
                {/* Main Row */}
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedDeal(isExpanded ? null : deal.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-semibold">{deal.name}</h2>
                      <Badge className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span>{deal.contractTemplate.displayName}</span>
                      <span>•</span>
                      <span>{totalClauses} clauses</span>
                      <span>•</span>
                      <span>Created {format(new Date(deal.createdAt), "MMM d, yyyy")}</span>
                    </div>

                    {/* Parties */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
                          {(initiator?.name || initiator?.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{initiator?.name || initiator?.email}</p>
                          <p className={`text-xs ${partyStatusConfig[initiator?.status || "PENDING"].color}`}>
                            {partyStatusConfig[initiator?.status || "PENDING"].label}
                          </p>
                        </div>
                      </div>

                      <ArrowRight className="w-4 h-4 text-muted-foreground" />

                      {respondent ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-500/20 flex items-center justify-center text-blue-500 text-sm font-semibold">
                            {(respondent.name || respondent.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{respondent.name || respondent.email}</p>
                            <p className={`text-xs ${partyStatusConfig[respondent.status].color}`}>
                              {partyStatusConfig[respondent.status].label}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">No respondent yet</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Clause Progress Mini */}
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">{agreedClauses}/{totalClauses}</p>
                      <p className="text-xs text-muted-foreground">agreed</p>
                    </div>
                    <button className="p-2 text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-border space-y-6">
                    {/* Progress Bars */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Party A Progress</span>
                          <span className="font-medium">
                            {initiator?.status === "SUBMITTED" || initiator?.status === "REVIEWING" || initiator?.status === "ACCEPTED"
                              ? "Complete"
                              : "In Progress"}
                          </span>
                        </div>
                        <Progress
                          value={
                            initiator?.status === "PENDING"
                              ? 25
                              : initiator?.status === "SUBMITTED"
                              ? 100
                              : 100
                          }
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Party B Progress</span>
                          <span className="font-medium">
                            {!respondent
                              ? "Not Started"
                              : respondent.status === "SUBMITTED" || respondent.status === "REVIEWING" || respondent.status === "ACCEPTED"
                              ? "Complete"
                              : "In Progress"}
                          </span>
                        </div>
                        <Progress
                          value={
                            !respondent
                              ? 0
                              : respondent.status === "PENDING"
                              ? 25
                              : 100
                          }
                          className="h-2"
                        />
                      </div>
                    </div>

                    {/* Clause Breakdown */}
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Clause Status
                      </h3>
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <div className="p-3 bg-muted/30 border border-border">
                          <p className="text-lg font-bold text-muted-foreground">
                            {totalClauses - agreedClauses - suggestedClauses - divergentClauses}
                          </p>
                          <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30">
                          <p className="text-lg font-bold text-yellow-500">{divergentClauses}</p>
                          <p className="text-xs text-yellow-500">Divergent</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30">
                          <p className="text-lg font-bold text-blue-500">{suggestedClauses}</p>
                          <p className="text-xs text-blue-500">Suggested</p>
                        </div>
                        <div className="p-3 bg-primary/10 border border-primary/30">
                          <p className="text-lg font-bold text-primary">{agreedClauses}</p>
                          <p className="text-xs text-primary">Agreed</p>
                        </div>
                      </div>
                    </div>

                    {/* Clause Details Table */}
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Clause Details
                      </h3>
                      <div className="border border-border">
                        <div className="grid grid-cols-4 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
                          <div>Clause</div>
                          <div>Party A Selection</div>
                          <div>Party B Selection</div>
                          <div>Status</div>
                        </div>
                        {deal.clauses.map((clause) => {
                          const partyASelection = clause.selections.find(
                            (s) => s.partyId === initiator?.id
                          );
                          const partyBSelection = clause.selections.find(
                            (s) => s.partyId === respondent?.id
                          );
                          const sameSelection = partyASelection?.optionId === partyBSelection?.optionId;

                          return (
                            <div
                              key={clause.id}
                              className="grid grid-cols-4 gap-4 p-3 border-t border-border text-sm"
                            >
                              <div className="font-medium">{clause.clauseTemplate.title}</div>
                              <div>
                                {partyASelection ? (
                                  <span className="text-primary">{partyASelection.option.label}</span>
                                ) : (
                                  <span className="text-muted-foreground italic">Not selected</span>
                                )}
                              </div>
                              <div>
                                {partyBSelection ? (
                                  <span className={sameSelection ? "text-primary" : "text-blue-500"}>
                                    {partyBSelection.option.label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic">Not selected</span>
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

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="flex items-center gap-2 px-4 py-2 border border-border text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Deal
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
