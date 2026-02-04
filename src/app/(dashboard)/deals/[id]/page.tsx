"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
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

const statusConfig = {
  DRAFT: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  AWAITING_RESPONSE: { label: "Awaiting Response", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  NEGOTIATING: { label: "Negotiating", color: "bg-blue-500/20 text-blue-500", icon: Users },
  AGREED: { label: "Agreed", color: "bg-primary/20 text-primary", icon: CheckCircle },
  SIGNING: { label: "Signing", color: "bg-purple-500/20 text-purple-500", icon: FileText },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-500", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-orange-500/20 text-orange-500", icon: AlertCircle },
};

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");

  const { data: deal, isLoading, error, refetch } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: progress } = trpc.deal.getProgress.useQuery({ id: dealId });

  const sendInvite = trpc.invitation.send.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      setInviteOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to send invitation: ${error.message}`);
    },
  });

  const cancelDeal = trpc.deal.cancel.useMutation({
    onSuccess: () => {
      toast.success("Deal cancelled");
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
          <span>Failed to load deal: {error?.message || "Not found"}</span>
        </div>
      </div>
    );
  }

  const status = statusConfig[deal.status];
  const StatusIcon = status.icon;
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
              {isInitiator && initiator?.status === "PENDING" ? "Make Selections" : "Continue Negotiation"}
            </Link>
          )}
          {deal.status === "NEGOTIATING" && (
            <Link
              href={`/deals/${deal.id}/review`}
              className="btn-brutal-outline flex items-center gap-2"
            >
              Review Compromises
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card-neutral">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Your Selections</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="metric-lg text-foreground">{progress.initiatorProgress.completed}</span>
              <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
            </div>
            <Progress value={progress.initiatorProgress.percentage} className="h-1.5" />
          </div>
          <div className="stat-card-neutral">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Counterparty</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="metric-lg text-foreground">{progress.respondentProgress.completed}</span>
              <span className="text-muted-foreground font-display">/ {progress.totalClauses}</span>
            </div>
            <Progress value={progress.respondentProgress.percentage} className="h-1.5" />
          </div>
          <div className="stat-card">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Agreed Clauses</p>
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
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Initiator</span>
            {isInitiator && <Badge variant="outline" className="text-xs">You</Badge>}
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
              {initiator?.status === "SUBMITTED" ? "Selections Submitted" : "Pending"}
            </Badge>
          </div>
        </div>

        {/* Respondent */}
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Counterparty</span>
            {!isInitiator && deal.currentUserRole === "RESPONDENT" && <Badge variant="outline" className="text-xs">You</Badge>}
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
                {respondent.status === "SUBMITTED" ? "Selections Submitted" : respondent.userId ? "Accepted, Pending Selections" : "Invitation Pending"}
              </Badge>
            </div>
          ) : canInvite ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No counterparty invited yet. Send an invitation to begin negotiation.
              </p>
              <button
                onClick={() => setInviteOpen(true)}
                className="btn-brutal-outline flex items-center gap-2 w-full justify-center"
              >
                <Mail className="w-4 h-4" />
                Invite Counterparty
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete your selections before inviting the counterparty.
            </p>
          )}
        </div>
      </div>

      {/* Clauses Summary */}
      <div className="card-brutal">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="font-semibold">Clauses</h2>
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
            Cancel Deal
          </button>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Invite Counterparty</DialogTitle>
            <DialogDescription>
              Send an invitation to the other party to begin negotiation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address *</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="counterparty@company.com"
                className="input-brutal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteName">Contact Name</Label>
              <Input
                id="inviteName"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="John Smith"
                className="input-brutal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteCompany">Company</Label>
              <Input
                id="inviteCompany"
                value={inviteCompany}
                onChange={(e) => setInviteCompany(e.target.value)}
                placeholder="Acme Corp"
                className="input-brutal"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setInviteOpen(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!inviteEmail.trim()) {
                  toast.error("Email is required");
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
              {sendInvite.isPending ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
