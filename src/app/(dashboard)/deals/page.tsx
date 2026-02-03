"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
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

const statusConfig = {
  DRAFT: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  AWAITING_RESPONSE: { label: "Awaiting Response", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  NEGOTIATING: { label: "Negotiating", color: "bg-blue-500/20 text-blue-500", icon: Users },
  AGREED: { label: "Agreed", color: "bg-primary/20 text-primary", icon: CheckCircle },
  SIGNING: { label: "Signing", color: "bg-purple-500/20 text-purple-500", icon: FileText },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-500", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-orange-500/20 text-orange-500", icon: AlertCircle },
};

export default function DealsPage() {
  const { data: deals, isLoading, error } = trpc.deal.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Deals</h1>
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
          <span>Failed to load deals: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Deals</h1>
          <p className="text-muted-foreground mt-1">
            Manage your contract negotiations
          </p>
        </div>
        <Link href="/deals/new" className="btn-brutal flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Deal
        </Link>
      </div>

      {deals?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No deals yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first deal room to start negotiating contracts
          </p>
          <Link href="/deals/new" className="btn-brutal inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Deal Room
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {deals?.map((deal) => {
            const status = statusConfig[deal.status];
            const StatusIcon = status.icon;
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
                      <Badge className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {deal.contractTemplate.displayName}
                      </span>
                      <span>•</span>
                      <span>{deal._count.clauses} clauses</span>
                      <span>•</span>
                      <span>Updated {format(new Date(deal.updatedAt), "MMM d, yyyy")}</span>
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
