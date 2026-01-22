"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  Scale,
  ThumbsUp,
  ThumbsDown,
  FileSignature,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CounterProposalForm {
  clauseId: string;
  clauseTitle: string;
  options: Array<{
    id: string;
    label: string;
    plainDescription: string;
    order: number;
  }>;
  currentSuggestionId: string;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [counterProposalForm, setCounterProposalForm] = useState<CounterProposalForm | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [rationale, setRationale] = useState<string>("");
  const [expandedClause, setExpandedClause] = useState<string | null>(null);

  const { data: deal, isLoading: dealLoading } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: suggestions, isLoading: suggestionsLoading, refetch } = trpc.compromise.getCurrent.useQuery({ dealRoomId: dealId });
  const { data: satisfactionScores } = trpc.compromise.getSatisfactionScores.useQuery({ dealRoomId: dealId });
  const { data: counterProposals, refetch: refetchCounterProposals } = trpc.compromise.getCounterProposals.useQuery({ dealRoomId: dealId });

  const generateCompromise = trpc.compromise.generate.useMutation({
    onSuccess: () => {
      toast.success("Compromise suggestions generated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate compromises: ${error.message}`);
    },
  });

  const regenerateCompromise = trpc.compromise.regenerate.useMutation({
    onSuccess: (data) => {
      toast.success(`Round ${data.roundNumber}: New suggestions generated`);
      refetch();
      refetchCounterProposals();
    },
    onError: (error) => {
      toast.error(`Failed to regenerate: ${error.message}`);
    },
  });

  const respondToSuggestion = trpc.compromise.respond.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to respond: ${error.message}`);
    },
  });

  const submitCounterProposal = trpc.compromise.counterPropose.useMutation({
    onSuccess: () => {
      toast.success("Counter-proposal submitted");
      setCounterProposalForm(null);
      setSelectedOptionId("");
      setRationale("");
      refetch();
      refetchCounterProposals();
    },
    onError: (error) => {
      toast.error(`Failed to submit counter-proposal: ${error.message}`);
    },
  });

  const respondToCounterProposal = trpc.compromise.respondToCounterProposal.useMutation({
    onSuccess: (data) => {
      if (data.accepted) {
        toast.success("Counter-proposal accepted");
        if (data.allAgreed) {
          toast.success("All clauses agreed! Proceeding to signing...");
        }
      } else {
        toast.success("Counter-proposal rejected");
      }
      refetch();
      refetchCounterProposals();
    },
    onError: (error) => {
      toast.error(`Failed to respond: ${error.message}`);
    },
  });

  const isLoading = dealLoading || suggestionsLoading;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-16"></div>
        <div className="card-brutal animate-pulse h-96"></div>
      </div>
    );
  }

  if (!deal || !suggestions) {
    return (
      <div className="card-brutal border-destructive">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load review data</span>
        </div>
      </div>
    );
  }

  const needsGeneration = suggestions.every((s) => !s.suggestion);
  const agreedCount = suggestions.filter((s) => s.status === "AGREED").length;
  const pendingCount = suggestions.filter((s) => s.status !== "AGREED").length;
  const allAgreed = agreedCount === suggestions.length;

  const isInitiator = deal.currentUserRole === "INITIATOR";
  const pendingCounterProposalsForMe = counterProposals?.pendingForMe || [];

  // Check if there are rejections that need new suggestions
  const hasRejections = suggestions.some((item) => {
    const suggestion = item.suggestion;
    if (!suggestion) return false;
    const myAccepted = isInitiator ? suggestion.partyAAccepted : suggestion.partyBAccepted;
    const otherAccepted = isInitiator ? suggestion.partyBAccepted : suggestion.partyAAccepted;
    return myAccepted === false || otherAccepted === false;
  });

  const handleRejectWithCounter = (clauseId: string, clauseTitle: string, options: CounterProposalForm["options"], suggestionId: string) => {
    setCounterProposalForm({
      clauseId,
      clauseTitle,
      options,
      currentSuggestionId: suggestionId,
    });
  };

  const handleSubmitCounterProposal = () => {
    if (!counterProposalForm || !selectedOptionId) return;

    submitCounterProposal.mutate({
      dealRoomClauseId: counterProposalForm.clauseId,
      proposedOptionId: selectedOptionId,
      rationale: rationale || undefined,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Review Compromises</h1>
            <p className="text-sm text-muted-foreground">
              {deal.name} • {deal.contractTemplate.displayName}
              {deal.currentRound > 0 && ` • Round ${deal.currentRound}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasRejections && !allAgreed && (
            <button
              onClick={() => regenerateCompromise.mutate({ dealRoomId: dealId })}
              disabled={regenerateCompromise.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-border hover:border-primary"
            >
              <RefreshCw className={`w-4 h-4 ${regenerateCompromise.isPending ? "animate-spin" : ""}`} />
              {regenerateCompromise.isPending ? "Generating..." : "New Round"}
            </button>
          )}
          {allAgreed && (
            <button
              onClick={() => router.push(`/deals/${dealId}/sign`)}
              className="btn-brutal flex items-center gap-2"
            >
              <FileSignature className="w-4 h-4" />
              Proceed to Signing
            </button>
          )}
        </div>
      </div>

      {/* Pending Counter-Proposals Alert */}
      {pendingCounterProposalsForMe.length > 0 && (
        <div className="card-brutal border-yellow-500/50 bg-yellow-500/10">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-200">
                {pendingCounterProposalsForMe.length} Counter-Proposal{pendingCounterProposalsForMe.length > 1 ? "s" : ""} Awaiting Your Response
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                The other party has proposed alternatives for some clauses. Review and respond below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Satisfaction Scores */}
      {satisfactionScores && !needsGeneration && (
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold">Overall Satisfaction</span>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {satisfactionScores.partyA.name}
                  {isInitiator && " (You)"}
                </span>
                <span className="font-semibold text-primary">{satisfactionScores.partyA.satisfaction}%</span>
              </div>
              <Progress value={satisfactionScores.partyA.satisfaction} className="h-3 [&>div]:bg-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {satisfactionScores.partyB.name}
                  {!isInitiator && " (You)"}
                </span>
                <span className="font-semibold">{satisfactionScores.partyB.satisfaction}%</span>
              </div>
              <Progress value={satisfactionScores.partyB.satisfaction} className="h-3" />
            </div>
          </div>
        </div>
      )}

      {/* Progress Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold text-primary">{agreedCount}</p>
          <p className="text-sm text-muted-foreground">Agreed</p>
        </div>
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold">{pendingCount}</p>
          <p className="text-sm text-muted-foreground">Pending</p>
        </div>
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold">{suggestions.length}</p>
          <p className="text-sm text-muted-foreground">Total Clauses</p>
        </div>
      </div>

      {/* Generate Button (if needed) */}
      {needsGeneration && (
        <div className="card-brutal text-center py-8">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Ready to Generate Compromises</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Both parties have submitted their selections. Generate AI-powered compromise suggestions based on priorities and flexibility.
          </p>
          <button
            onClick={() => generateCompromise.mutate({ dealRoomId: dealId })}
            disabled={generateCompromise.isPending}
            className="btn-brutal"
          >
            {generateCompromise.isPending ? "Generating..." : "Generate Compromise Suggestions"}
          </button>
        </div>
      )}

      {/* Counter-Proposal Modal */}
      {counterProposalForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="card-brutal max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Counter-Propose: {counterProposalForm.clauseTitle}</h2>
              <button
                onClick={() => {
                  setCounterProposalForm(null);
                  setSelectedOptionId("");
                  setRationale("");
                }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Select an alternative option you'd like to propose:
            </p>

            <div className="space-y-3 mb-6">
              {counterProposalForm.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOptionId(option.id)}
                  className={`
                    w-full text-left p-4 border transition-colors
                    ${selectedOptionId === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground"
                    }
                  `}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{option.plainDescription}</p>
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Rationale (optional)
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Explain why you're proposing this alternative..."
                className="w-full p-3 bg-background border border-border focus:border-primary outline-none resize-none h-24"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setCounterProposalForm(null);
                  setSelectedOptionId("");
                  setRationale("");
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCounterProposal}
                disabled={!selectedOptionId || submitCounterProposal.isPending}
                className="btn-brutal disabled:opacity-50"
              >
                {submitCounterProposal.isPending ? "Submitting..." : "Submit Counter-Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clause Suggestions */}
      {!needsGeneration && (
        <div className="space-y-4">
          {suggestions.map((item) => {
            const suggestion = item.suggestion;
            const mySelection = item.selections.find(
              (s) => s.partyId === deal.currentPartyId
            );
            const otherSelection = item.selections.find(
              (s) => s.partyId !== deal.currentPartyId
            );

            const myAccepted = isInitiator ? suggestion?.partyAAccepted : suggestion?.partyBAccepted;
            const otherAccepted = isInitiator ? suggestion?.partyBAccepted : suggestion?.partyAAccepted;

            // Find counter-proposals for this clause
            const clauseCounterProposals = counterProposals?.toMe.filter(
              (cp) => cp.dealRoomClauseId === item.clauseId && cp.status === "PENDING"
            ) || [];

            const isExpanded = expandedClause === item.clauseId;

            return (
              <div
                key={item.clauseId}
                className={`card-brutal ${item.status === "AGREED" ? "border-primary" : ""} ${clauseCounterProposals.length > 0 ? "border-yellow-500/50" : ""}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.clauseTitle}</h3>
                      {item.status === "AGREED" && (
                        <Badge className="bg-primary/20 text-primary">
                          <Check className="w-3 h-3 mr-1" />
                          Agreed
                        </Badge>
                      )}
                      {clauseCounterProposals.length > 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-500">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Counter-Proposal
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.category}</p>
                  </div>
                  <button
                    onClick={() => setExpandedClause(isExpanded ? null : item.clauseId)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {/* Counter-Proposal Alert */}
                {clauseCounterProposals.length > 0 && (
                  <div className="mb-4 p-4 border border-yellow-500/30 bg-yellow-500/10">
                    <p className="text-sm font-medium text-yellow-200 mb-3">
                      The other party has proposed an alternative:
                    </p>
                    {clauseCounterProposals.map((cp) => (
                      <div key={cp.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{cp.proposedOption.label}</p>
                            <p className="text-sm text-muted-foreground">{cp.proposedOption.plainDescription}</p>
                          </div>
                        </div>
                        {cp.rationale && (
                          <p className="text-sm italic text-muted-foreground">
                            "{cp.rationale}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => respondToCounterProposal.mutate({
                              counterProposalId: cp.id,
                              accept: false,
                            })}
                            disabled={respondToCounterProposal.isPending}
                            className="flex items-center gap-2 px-4 py-2 border border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors"
                          >
                            <ThumbsDown className="w-4 h-4" />
                            Reject
                          </button>
                          <button
                            onClick={() => respondToCounterProposal.mutate({
                              counterProposalId: cp.id,
                              accept: true,
                            })}
                            disabled={respondToCounterProposal.isPending}
                            className="btn-brutal flex items-center gap-2"
                          >
                            <ThumbsUp className="w-4 h-4" />
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selections Comparison */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Your Selection</p>
                    <p className="font-medium">{mySelection?.option.label || "—"}</p>
                  </div>
                  <div className="p-4 bg-primary/10 border border-primary">
                    <p className="text-xs text-primary uppercase tracking-wider mb-2">Suggested</p>
                    <p className="font-medium text-primary">
                      {suggestion?.suggestedOption.label || "—"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Their Selection</p>
                    <p className="font-medium">{otherSelection?.option.label || "—"}</p>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && suggestion && (
                  <>
                    {/* Reasoning */}
                    <div className="mb-4 p-4 bg-muted/20 border border-border">
                      <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                    </div>

                    {/* Satisfaction for this clause */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Your satisfaction:</span>
                        <Progress
                          value={isInitiator ? suggestion.satisfactionPartyA : suggestion.satisfactionPartyB}
                          className="flex-1 h-2"
                        />
                        <span className="text-sm font-medium">
                          {isInitiator ? suggestion.satisfactionPartyA : suggestion.satisfactionPartyB}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Their satisfaction:</span>
                        <Progress
                          value={isInitiator ? suggestion.satisfactionPartyB : suggestion.satisfactionPartyA}
                          className="flex-1 h-2"
                        />
                        <span className="text-sm font-medium">
                          {isInitiator ? suggestion.satisfactionPartyB : suggestion.satisfactionPartyA}%
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Accept/Reject Status & Buttons */}
                {suggestion && item.status !== "AGREED" && (
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">You:</span>
                        {myAccepted === true && <Badge className="bg-primary/20 text-primary">Accepted</Badge>}
                        {myAccepted === false && <Badge className="bg-destructive/20 text-destructive">Rejected</Badge>}
                        {myAccepted === null && <Badge variant="outline">Pending</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">They:</span>
                        {otherAccepted === true && <Badge className="bg-primary/20 text-primary">Accepted</Badge>}
                        {otherAccepted === false && <Badge className="bg-destructive/20 text-destructive">Rejected</Badge>}
                        {otherAccepted === null && <Badge variant="outline">Pending</Badge>}
                      </div>
                    </div>

                    {myAccepted === null && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRejectWithCounter(
                            item.clauseId,
                            item.clauseTitle,
                            item.options.map((o) => ({
                              id: o.id,
                              label: o.label,
                              plainDescription: o.plainDescription,
                              order: o.order,
                            })),
                            suggestion.id
                          )}
                          className="flex items-center gap-2 px-4 py-2 border border-muted-foreground text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Counter-Propose
                        </button>
                        <button
                          onClick={() => respondToSuggestion.mutate({
                            dealRoomClauseId: item.clauseId,
                            accept: false,
                          })}
                          disabled={respondToSuggestion.isPending}
                          className="flex items-center gap-2 px-4 py-2 border border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => respondToSuggestion.mutate({
                            dealRoomClauseId: item.clauseId,
                            accept: true,
                          })}
                          disabled={respondToSuggestion.isPending}
                          className="btn-brutal flex items-center gap-2"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Accept
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* All Agreed Banner */}
      {allAgreed && (
        <div className="card-brutal border-primary text-center py-8">
          <Check className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">All Clauses Agreed!</h2>
          <p className="text-muted-foreground mb-6">
            Congratulations! Both parties have agreed on all clauses. Proceed to e-signature.
          </p>
          <button
            onClick={() => router.push(`/deals/${dealId}/sign`)}
            className="btn-brutal flex items-center gap-2 mx-auto"
          >
            <FileSignature className="w-4 h-4" />
            Proceed to Signing
          </button>
        </div>
      )}
    </div>
  );
}
