"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { format } from "date-fns";
import {
  FileText,
  Search,
  AlertCircle,
  Loader2,
  Users,
  CheckCircle,
  Clock,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const statusConfig = {
  DRAFT: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  AWAITING_RESPONSE: { label: "Awaiting", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  NEGOTIATING: { label: "Negotiating", color: "bg-blue-500/20 text-blue-500", icon: Users },
  AGREED: { label: "Agreed", color: "bg-primary/20 text-primary", icon: CheckCircle },
  SIGNING: { label: "Signing", color: "bg-purple-500/20 text-purple-500", icon: FileText },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-500", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-destructive/20 text-destructive", icon: AlertCircle },
};

export default function AllDealsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: deals, isLoading, error } = trpc.platformAdmin.listAllDeals.useQuery();
  const { data: supervisors } = trpc.platformAdmin.listSupervisors.useQuery();

  const assignMutation = trpc.platformAdmin.assignSupervisor.useMutation({
    onSuccess: () => {
      utils.platformAdmin.listAllDeals.invalidate();
      setSelectedDeal(null);
      setSelectedSupervisor("");
    },
  });

  const unassignMutation = trpc.platformAdmin.removeSupervisorAssignment.useMutation({
    onSuccess: () => {
      utils.platformAdmin.listAllDeals.invalidate();
    },
  });

  const filteredDeals = deals?.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.parties.some(
        (p) =>
          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">All Deals</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Deals</h1>
          <p className="text-muted-foreground mt-1">
            View all deals and assign supervisors
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search deals by name or party..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-brutal pl-10"
        />
      </div>

      {/* Deals List */}
      {filteredDeals?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No deals found</h2>
          <p className="text-muted-foreground">
            {searchQuery ? "Try a different search term" : "No deals in the system yet"}
          </p>
        </div>
      ) : (
        <div className="border border-border">
          <div className="grid grid-cols-6 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
            <div>Deal Name</div>
            <div>Parties</div>
            <div>Status</div>
            <div>Created</div>
            <div>Supervisor</div>
            <div>Actions</div>
          </div>
          {filteredDeals?.map((deal) => {
            const status = statusConfig[deal.status];
            const StatusIcon = status.icon;
            const initiator = deal.parties.find((p) => p.role === "INITIATOR");
            const respondent = deal.parties.find((p) => p.role === "RESPONDENT");
            const assignments = deal.supervisorAssignments || [];

            return (
              <div
                key={deal.id}
                className="grid grid-cols-6 gap-4 p-3 border-t border-border items-center text-sm"
              >
                <div>
                  <p className="font-medium">{deal.name}</p>
                  <p className="text-muted-foreground text-xs">{deal.contractTemplate.displayName}</p>
                </div>
                <div className="text-xs">
                  <p className="text-primary">{initiator?.name || initiator?.email}</p>
                  {respondent && (
                    <p className="text-blue-500">vs {respondent.name || respondent.email}</p>
                  )}
                </div>
                <div>
                  <Badge className={status.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
                <div className="text-muted-foreground">
                  {format(new Date(deal.createdAt), "MMM d, yyyy")}
                </div>
                <div>
                  {assignments.length > 0 ? (
                    <div className="space-y-1">
                      {assignments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <Badge className="bg-purple-500/20 text-purple-500 text-xs">
                            {a.supervisor.name || a.supervisor.email}
                          </Badge>
                          <button
                            onClick={() => unassignMutation.mutate({ assignmentId: a.id })}
                            className="text-muted-foreground hover:text-destructive text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Not assigned</span>
                  )}
                </div>
                <div>
                  {selectedDeal === deal.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedSupervisor}
                        onChange={(e) => setSelectedSupervisor(e.target.value)}
                        className="text-xs border border-border px-2 py-1 bg-background"
                      >
                        <option value="">Select...</option>
                        {supervisors
                          ?.filter((s) => s.isActive)
                          .filter((s) => !assignments.some((a) => a.supervisorId === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name || s.email}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => {
                          if (selectedSupervisor) {
                            assignMutation.mutate({
                              supervisorId: selectedSupervisor,
                              dealRoomId: deal.id,
                            });
                          }
                        }}
                        disabled={!selectedSupervisor || assignMutation.isPending}
                        className="text-green-500 hover:text-green-600 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDeal(null);
                          setSelectedSupervisor("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedDeal(deal.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-purple-500 text-purple-500 hover:bg-purple-500/10"
                    >
                      <UserCog className="w-3 h-3" />
                      Assign
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
