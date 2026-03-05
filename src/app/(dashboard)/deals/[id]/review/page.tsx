"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Scale,
  ThumbsUp,
  ThumbsDown,
  FileSignature,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Shield,
  Download,
  Loader2,
  UserCheck,
  XCircle,
  Info,
  Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

function DownloadLinks({ dealId, className }: { dealId: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      <Download className="w-3.5 h-3.5 flex-shrink-0" />
      <a href={`/api/deals/${dealId}/document`} className="hover:text-foreground underline underline-offset-2">PDF</a>
      <span aria-hidden>·</span>
      <a href={`/api/deals/${dealId}/document/docx`} className="hover:text-foreground underline underline-offset-2">DOCX</a>
      <span aria-hidden>·</span>
      <a href={`/api/deals/${dealId}/document/txt`} className="hover:text-foreground underline underline-offset-2">TXT</a>
    </div>
  );
}

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

/** Outer wrapper: determines contract language and provides correct locale */
export default function ReviewPage() {
  const params = useParams();
  const dealId = params.id as string;
  const { data: deal } = trpc.deal.getById.useQuery({ id: dealId });
  const contractLang = (deal as any)?.contractLanguage || "en";
  const messages = contractLang === "es" ? esMessages : enMessages;

  return (
    <NextIntlClientProvider locale={contractLang} messages={messages}>
      <ReviewContent dealId={dealId} />
    </NextIntlClientProvider>
  );
}

/** Inner component: all UI and hooks, picks up contract locale from provider */
function ReviewContent({ dealId }: { dealId: string }) {
  const router = useRouter();

  const t = useTranslations("review");
  const tCommon = useTranslations("common");
  const tJointCounsel = useTranslations("jointCounsel");

  const [counterProposalForm, setCounterProposalForm] = useState<CounterProposalForm | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [rationale, setRationale] = useState<string>("");
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [showAttorneyModal, setShowAttorneyModal] = useState(false);
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<string>("");

  const { data: deal, isLoading: dealLoading } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: suggestions, isLoading: suggestionsLoading, refetch } = trpc.compromise.getCurrent.useQuery({ dealRoomId: dealId });
  const { data: satisfactionScores } = trpc.compromise.getSatisfactionScores.useQuery({ dealRoomId: dealId });
  const { data: counterProposals, refetch: refetchCounterProposals } = trpc.compromise.getCounterProposals.useQuery({ dealRoomId: dealId });
  const { data: validation } = trpc.compromise.getValidation.useQuery({ dealRoomId: dealId });

  // Attorney review queries
  const { data: reviewStatus, refetch: refetchReviewStatus } = trpc.attorneyReview.getReviewStatus.useQuery({ dealRoomId: dealId });
  const { data: availableAttorneys, isLoading: attorneysLoading, error: attorneysError } = trpc.attorneyReview.listAvailableAttorneys.useQuery(
    { dealRoomId: dealId },
    { enabled: showAttorneyModal }
  );

  const generateCompromise = trpc.compromise.generate.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.compromiseGenerated"));
      refetch();
    },
    onError: (error) => {
      toast.error(t("toastMessages.generateFailed", { error: error.message }));
    },
  });

  const regenerateCompromise = trpc.compromise.regenerate.useMutation({
    onSuccess: (data) => {
      toast.success(t("toastMessages.newSuggestionsGenerated", { number: data.roundNumber }));
      refetch();
      refetchCounterProposals();
    },
    onError: (error) => {
      toast.error(t("toastMessages.regenerateFailed", { error: error.message }));
    },
  });

  const respondToSuggestion = trpc.compromise.respond.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(t("toastMessages.respondFailed", { error: error.message }));
    },
  });

  const submitCounterProposal = trpc.compromise.counterPropose.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.counterProposalSubmitted"));
      setCounterProposalForm(null);
      setSelectedOptionId("");
      setRationale("");
      refetch();
      refetchCounterProposals();
    },
    onError: (error) => {
      toast.error(t("toastMessages.submitFailed", { error: error.message }));
    },
  });

  const requestReview = trpc.attorneyReview.requestReview.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.attorneyReviewRequested"));
      setShowAttorneyModal(false);
      setSelectedAttorneyId("");
      refetchReviewStatus();
    },
    onError: (error) => {
      toast.error(t("toastMessages.requestFailed", { error: error.message }));
    },
  });

  const cancelReview = trpc.attorneyReview.cancelReview.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.attorneyReviewCancelled"));
      refetchReviewStatus();
    },
    onError: (error) => {
      toast.error(t("toastMessages.cancelFailed", { error: error.message }));
    },
  });

  // Joint counsel
  const [showJointCounselModal, setShowJointCounselModal] = useState(false);
  const [selectedJointCounselId, setSelectedJointCounselId] = useState("");

  const { data: jointCounselStatus, refetch: refetchJointCounsel } = trpc.jointCounsel.getStatus.useQuery({ dealRoomId: dealId });
  const { data: availableJointCounsel, isLoading: jointCounselLoading } = trpc.jointCounsel.listAvailable.useQuery(
    { dealRoomId: dealId },
    { enabled: showJointCounselModal }
  );

  const requestJointCounsel = trpc.jointCounsel.request.useMutation({
    onSuccess: () => {
      toast.success(tJointCounsel("toastMessages.requested"));
      setShowJointCounselModal(false);
      setSelectedJointCounselId("");
      refetchJointCounsel();
    },
    onError: (error) => {
      toast.error(tJointCounsel("toastMessages.requestFailed", { error: error.message }));
    },
  });

  const acknowledgeJointCounsel = trpc.jointCounsel.acknowledge.useMutation({
    onSuccess: () => {
      toast.success(tJointCounsel("toastMessages.acknowledged"));
      refetchJointCounsel();
    },
    onError: (error) => {
      toast.error(tJointCounsel("toastMessages.acknowledgeFailed", { error: error.message }));
    },
  });

  const declineJointCounsel = trpc.jointCounsel.decline.useMutation({
    onSuccess: () => {
      toast.success(tJointCounsel("toastMessages.declined"));
      refetchJointCounsel();
    },
    onError: (error) => {
      toast.error(tJointCounsel("toastMessages.declineFailed", { error: error.message }));
    },
  });

  const respondToCounterProposal = trpc.compromise.respondToCounterProposal.useMutation({
    onSuccess: (data) => {
      if (data.accepted) {
        toast.success(t("toastMessages.counterProposalAccepted"));
        if (data.allAgreed) {
          toast.success(t("toastMessages.allAgreedProceeding"));
        }
      } else {
        toast.success(t("toastMessages.counterProposalRejected"));
      }
      refetch();
      refetchCounterProposals();
    },
    onError: (error) => {
      toast.error(t("toastMessages.respondFailed", { error: error.message }));
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
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertCircle className="w-5 h-5" />
          <span>{t("failedToLoad")}</span>
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
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{t("reviewCompromises")}</h1>
            <p className="text-sm text-muted-foreground truncate">
              {deal.name} • {deal.contractTemplate.displayName}
              {deal.currentRound > 0 && ` • ${t("round", { number: deal.currentRound })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasRejections && !allAgreed && (
            <button
              onClick={() => regenerateCompromise.mutate({ dealRoomId: dealId })}
              disabled={regenerateCompromise.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-border hover:border-primary rounded-full"
            >
              <RefreshCw className={`w-4 h-4 ${regenerateCompromise.isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{regenerateCompromise.isPending ? t("generating") : t("newRound")}</span>
            </button>
          )}
          {allAgreed && reviewStatus?.canProceedToSigning && !(jointCounselStatus?.requested && !jointCounselStatus?.acknowledgedAt && !jointCounselStatus?.declinedAt) && (
            <button
              onClick={() => router.push(`/deals/${dealId}/sign`)}
              className="btn-brutal flex items-center gap-2"
            >
              <FileSignature className="w-4 h-4" />
              <span className="hidden sm:inline">{t("proceedToSigning")}</span>
              <ArrowRight className="w-4 h-4 sm:hidden" />
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
                {t("counterProposalsPending", { count: pendingCounterProposalsForMe.length, plural: pendingCounterProposalsForMe.length > 1 ? "s" : "" })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("counterProposalsDescription")}
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
            <span className="font-semibold">{t("overallSatisfaction")}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {satisfactionScores.partyA.name}
                  {isInitiator && ` (${tCommon("you")})`}
                </span>
                <span className="font-semibold text-primary">{satisfactionScores.partyA.satisfaction}%</span>
              </div>
              <Progress value={satisfactionScores.partyA.satisfaction} className="h-3 [&>div]:bg-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {satisfactionScores.partyB.name}
                  {!isInitiator && ` (${tCommon("you")})`}
                </span>
                <span className="font-semibold">{satisfactionScores.partyB.satisfaction}%</span>
              </div>
              <Progress value={satisfactionScores.partyB.satisfaction} className="h-3" />
            </div>
          </div>
        </div>
      )}

      {/* Progress Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold text-primary">{agreedCount}</p>
          <p className="text-sm text-muted-foreground">{tCommon("agreed")}</p>
        </div>
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold">{pendingCount}</p>
          <p className="text-sm text-muted-foreground">{tCommon("pending")}</p>
        </div>
        <div className="card-brutal text-center">
          <p className="text-3xl font-bold">{suggestions.length}</p>
          <p className="text-sm text-muted-foreground">{t("totalClauses")}</p>
        </div>
      </div>

      {/* Cross-Clause Conflict Warnings (from Cloud Intelligence API) */}
      {validation?.conflicts && validation.conflicts.length > 0 && (
        <div className="card-brutal border-l-4 border-l-warning bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold text-warning">{t("conflictWarnings")}</p>
              {validation.conflicts.map((conflict, i) => (
                <div key={i} className="text-sm text-muted-foreground">
                  <span className={conflict.severity === "error" ? "text-destructive font-medium" : "text-warning"}>
                    {conflict.severity === "error" ? "Error: " : "Warning: "}
                  </span>
                  {conflict.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {validation && !validation.validated && !validation.conflicts.length && (
        <div className="text-xs text-muted-foreground text-center">
          {t("validationUnavailable")}
        </div>
      )}

      {/* Generate Button (if needed) */}
      {needsGeneration && (
        <div className="card-brutal text-center py-8">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("readyToGenerate")}</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("readyToGenerateDescription")}
          </p>
          <button
            onClick={() => generateCompromise.mutate({ dealRoomId: dealId })}
            disabled={generateCompromise.isPending}
            className="btn-brutal"
          >
            {generateCompromise.isPending ? t("generating") : t("generateCompromiseSuggestions")}
          </button>
        </div>
      )}

      {/* Counter-Proposal Modal */}
      {counterProposalForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="card-brutal max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{t("counterProposeTitle", { title: counterProposalForm.clauseTitle })}</h2>
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
              {t("selectAlternative")}
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
                {t("rationale")}
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder={t("rationalePlaceholder")}
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
                {tCommon("cancel")}
              </button>
              <button
                onClick={handleSubmitCounterProposal}
                disabled={!selectedOptionId || submitCounterProposal.isPending}
                className="btn-brutal disabled:opacity-50"
              >
                {submitCounterProposal.isPending ? t("generating") : t("submitCounterProposal")}
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
                          {tCommon("agreed")}
                        </Badge>
                      )}
                      {clauseCounterProposals.length > 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-500">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {t("counterProposalBadge")}
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
                      {t("otherPartyProposed")}
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
                        <div className="flex items-center gap-2 pt-2 flex-wrap">
                          <button
                            onClick={() => respondToCounterProposal.mutate({
                              counterProposalId: cp.id,
                              accept: false,
                            })}
                            disabled={respondToCounterProposal.isPending}
                            className="flex items-center gap-2 px-3 py-2 border border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-colors rounded-full text-sm"
                          >
                            <ThumbsDown className="w-4 h-4" />
                            {t("reject")}
                          </button>
                          <button
                            onClick={() => respondToCounterProposal.mutate({
                              counterProposalId: cp.id,
                              accept: true,
                            })}
                            disabled={respondToCounterProposal.isPending}
                            className="btn-brutal flex items-center gap-2 text-sm"
                          >
                            <ThumbsUp className="w-4 h-4" />
                            {t("accept")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selections Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("yourSelection")}</p>
                    <p className="font-medium">{mySelection?.option.label || "—"}</p>
                  </div>
                  <div className="p-4 bg-primary/10 border border-primary">
                    <p className="text-xs text-primary uppercase tracking-wider mb-2">{t("suggested")}</p>
                    <p className="font-medium text-primary">
                      {suggestion?.suggestedOption.label || "—"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("theirSelection")}</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{t("yourSatisfaction")}</span>
                        <Progress
                          value={isInitiator ? suggestion.satisfactionPartyA : suggestion.satisfactionPartyB}
                          className="flex-1 h-2"
                        />
                        <span className="text-sm font-medium">
                          {isInitiator ? suggestion.satisfactionPartyA : suggestion.satisfactionPartyB}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{t("theirSatisfaction")}</span>
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
                  <div className="pt-4 border-t border-border space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{tCommon("you")}:</span>
                        {myAccepted === true && <Badge className="bg-primary/20 text-primary">{t("accepted")}</Badge>}
                        {myAccepted === false && <Badge className="bg-yellow-500/20 text-yellow-600">{t("rejected")}</Badge>}
                        {myAccepted === null && <Badge variant="outline">{tCommon("pending")}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t("they")}</span>
                        {otherAccepted === true && <Badge className="bg-primary/20 text-primary">{t("accepted")}</Badge>}
                        {otherAccepted === false && <Badge className="bg-yellow-500/20 text-yellow-600">{t("rejected")}</Badge>}
                        {otherAccepted === null && <Badge variant="outline">{tCommon("pending")}</Badge>}
                      </div>
                    </div>

                    {myAccepted === null && (
                      <div className="flex items-center gap-2 flex-wrap">
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
                          className="flex items-center gap-2 px-3 py-2 border border-muted-foreground text-muted-foreground hover:border-yellow-500 hover:text-yellow-600 transition-colors rounded-full text-sm"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="hidden sm:inline">{t("counterPropose")}</span>
                        </button>
                        <button
                          onClick={() => respondToSuggestion.mutate({
                            dealRoomClauseId: item.clauseId,
                            accept: false,
                          })}
                          disabled={respondToSuggestion.isPending}
                          className="flex items-center gap-2 px-3 py-2 border border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-colors rounded-full text-sm"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          {t("reject")}
                        </button>
                        <button
                          onClick={() => respondToSuggestion.mutate({
                            dealRoomClauseId: item.clauseId,
                            accept: true,
                          })}
                          disabled={respondToSuggestion.isPending}
                          className="btn-brutal flex items-center gap-2 text-sm"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          {t("accept")}
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

      {/* Attorney Selection Modal */}
      {showAttorneyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="card-brutal max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{t("selectReviewingAttorney")}</h2>
              <button
                onClick={() => {
                  setShowAttorneyModal(false);
                  setSelectedAttorneyId("");
                }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("chooseAttorneyDescription")}
            </p>
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {attorneysLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {attorneysError && (
                <div className="flex items-center gap-2 text-sm text-destructive py-4 px-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{attorneysError.message}</span>
                </div>
              )}
              {availableAttorneys?.map((attorney) => (
                <button
                  key={attorney.id}
                  onClick={() => !attorney.unavailable && setSelectedAttorneyId(attorney.id)}
                  disabled={attorney.unavailable}
                  className={`
                    w-full text-left p-4 border transition-colors
                    ${attorney.unavailable
                      ? "border-border opacity-50 cursor-not-allowed"
                      : selectedAttorneyId === attorney.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground"
                    }
                  `}
                >
                  <p className="font-semibold">
                    {attorney.name || attorney.email}
                    {attorney.unavailable && (
                      <span className="text-xs text-muted-foreground ml-2">{t("selectedByOtherParty")}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {attorney.email}
                    {attorney.barNumber && <span className="ml-2 text-xs text-primary">Bar #{attorney.barNumber}</span>}
                  </p>
                </button>
              ))}
              {!attorneysLoading && !attorneysError && availableAttorneys?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("noAttorneysAvailable")}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAttorneyModal(false);
                  setSelectedAttorneyId("");
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => {
                  if (selectedAttorneyId) {
                    requestReview.mutate({
                      dealRoomId: dealId,
                      supervisorId: selectedAttorneyId,
                    });
                  }
                }}
                disabled={!selectedAttorneyId || requestReview.isPending}
                className="btn-brutal disabled:opacity-50"
              >
                {requestReview.isPending ? t("requesting") : t("assignAttorney")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Agreed Section — with attorney review flow */}
      {allAgreed && (
        <>
          {/* My review in progress */}
          {reviewStatus?.myReview && !reviewStatus.myReview.approvedAt && (
            <div className="card-brutal border-purple-500/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-1">{t("attorneyReviewInProgress")}</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("reviewingOnBehalf", { name: reviewStatus.myReview.supervisorName ?? "" })}
                    {reviewStatus.myReview.requestedAt && (
                      <> {t("requestedOn", { date: new Date(reviewStatus.myReview.requestedAt).toLocaleDateString() })}</>
                    )}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <DownloadLinks dealId={dealId} />
                    <button
                      onClick={() => cancelReview.mutate({ dealRoomId: dealId })}
                      disabled={cancelReview.isPending}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-colors rounded-full"
                    >
                      <XCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">{cancelReview.isPending ? t("cancelling") : t("cancelReview")}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* My review approved */}
          {reviewStatus?.myReview?.approvedAt && (
            <div className="card-brutal border-primary">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{t("reviewApproved")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("approvedOn", { name: reviewStatus.myReview.supervisorName ?? "", date: new Date(reviewStatus.myReview.approvedAt!).toLocaleDateString() })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Other party has active review, I don't */}
          {reviewStatus?.otherPartyReviewActive && !reviewStatus.myReview && (
            <div className="card-brutal border-blue-500/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{t("otherPartyRequestedReview")}</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("otherPartyRequestedReviewDescription")}
                    {!reviewStatus.suppressReviewForInitiator && ` ${t("youMayRequestReview")}`}
                  </p>
                  {!reviewStatus.suppressReviewForInitiator && (
                    <button
                      onClick={() => setShowAttorneyModal(true)}
                      className="btn-brutal-outline inline-flex items-center gap-2 text-sm"
                    >
                      <Shield className="w-4 h-4" />
                      {t("requestYourOwnReview")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lawyer-vetted note for initiator */}
          {reviewStatus?.suppressReviewForInitiator && (
            <div className="card-brutal border-primary/50 bg-primary/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                  <Scale className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{t("attorneyVettedContract")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("contractVettedBy", { name: reviewStatus.vettingLawyerName ?? "" })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No reviews or all approved — show proceed + option to request */}
          {reviewStatus?.canProceedToSigning && (
            <div className="card-brutal border-primary text-center py-8">
              <Check className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">{t("allClausesAgreed")}</h2>
              <p className="text-muted-foreground mb-6">
                {reviewStatus.myReview?.approvedAt
                  ? t("allAgreedReviewComplete")
                  : reviewStatus.suppressReviewForInitiator
                  ? t("allAgreedLawyerVetted")
                  : t("allAgreedBothParties")
                }
              </p>
              <p className="text-sm text-muted-foreground mb-6 flex items-center justify-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                {t("signingDetailsHint")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => router.push(`/deals/${dealId}/sign`)}
                  className="btn-brutal flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <FileSignature className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("proceedToSigning")}</span>
                  <ArrowRight className="w-4 h-4 sm:hidden" />
                </button>
                {!reviewStatus.myReview && !reviewStatus.suppressReviewForInitiator && (
                  <button
                    onClick={() => setShowAttorneyModal(true)}
                    className="btn-brutal-outline flex items-center gap-2 w-full sm:w-auto justify-center"
                  >
                    <Shield className="w-4 h-4" />
                    {t("requestAttorneyReview")}
                  </button>
                )}
              </div>
              <DownloadLinks dealId={dealId} className="mt-4 justify-center" />
            </div>
          )}

          {/* Reviews active — signing blocked */}
          {!reviewStatus?.canProceedToSigning && !reviewStatus?.myReview && !reviewStatus?.otherPartyReviewActive && (
            <div className="card-brutal border-primary text-center py-8">
              <Check className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">{t("allClausesAgreed")}</h2>
              <p className="text-muted-foreground mb-6">
                {t("allAgreedSimple")}
              </p>
              <p className="text-sm text-muted-foreground mb-6 flex items-center justify-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                {t("signingDetailsHint")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => router.push(`/deals/${dealId}/sign`)}
                  className="btn-brutal flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <FileSignature className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("proceedToSigning")}</span>
                  <ArrowRight className="w-4 h-4 sm:hidden" />
                </button>
                {!reviewStatus?.suppressReviewForInitiator && (
                  <button
                    onClick={() => setShowAttorneyModal(true)}
                    className="btn-brutal-outline flex items-center gap-2 w-full sm:w-auto justify-center"
                  >
                    <Shield className="w-4 h-4" />
                    {t("requestAttorneyReview")}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Stage B — Joint Closing Counsel */}
      {allAgreed && (
        <>
          {/* Joint Counsel Selection Modal */}
          {showJointCounselModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="card-brutal max-w-lg w-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold">{tJointCounsel("selectCounsel")}</h2>
                  <button
                    onClick={() => {
                      setShowJointCounselModal(false);
                      setSelectedJointCounselId("");
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {tJointCounsel("selectCounselDescription")}
                </p>
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {jointCounselLoading && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {availableJointCounsel?.map((counsel) => (
                    <button
                      key={counsel.id}
                      onClick={() => setSelectedJointCounselId(counsel.id)}
                      className={`
                        w-full text-left p-4 border transition-colors
                        ${selectedJointCounselId === counsel.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
                        }
                      `}
                    >
                      <p className="font-semibold">{counsel.name || counsel.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {counsel.email}
                        {counsel.barNumber && <span className="ml-2 text-xs text-primary">Bar #{counsel.barNumber}</span>}
                      </p>
                    </button>
                  ))}
                  {!jointCounselLoading && availableJointCounsel?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {tJointCounsel("noCounselAvailable")}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowJointCounselModal(false);
                      setSelectedJointCounselId("");
                    }}
                    className="px-4 py-2 text-muted-foreground hover:text-foreground"
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    onClick={() => {
                      if (selectedJointCounselId) {
                        requestJointCounsel.mutate({
                          dealRoomId: dealId,
                          supervisorId: selectedJointCounselId,
                        });
                      }
                    }}
                    disabled={!selectedJointCounselId || requestJointCounsel.isPending}
                    className="btn-brutal disabled:opacity-50"
                  >
                    {requestJointCounsel.isPending ? tJointCounsel("requesting") : tJointCounsel("assignCounsel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No request yet — Initiator sees request button */}
          {!jointCounselStatus?.requested && isInitiator && (
            <div className="card-brutal border-purple-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-1">{tJointCounsel("title")}</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    {tJointCounsel("selectCounselDescription")}
                  </p>
                  <button
                    onClick={() => setShowJointCounselModal(true)}
                    className="btn-brutal-outline flex items-center gap-2 text-sm"
                  >
                    <Briefcase className="w-4 h-4" />
                    {tJointCounsel("requestJointCounsel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Requested, pending — Initiator sees status */}
          {jointCounselStatus?.requested && !jointCounselStatus.acknowledgedAt && !jointCounselStatus.declinedAt && jointCounselStatus.isInitiator && (
            <div className="card-brutal border-purple-500/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{tJointCounsel("pendingAcknowledgment")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {jointCounselStatus.supervisorName} — {tJointCounsel("pendingAcknowledgmentDescription")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Requested, pending — Other party sees acknowledge/decline */}
          {jointCounselStatus?.requested && !jointCounselStatus.acknowledgedAt && !jointCounselStatus.declinedAt && !jointCounselStatus.isInitiator && (
            <div className="card-brutal border-purple-500/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-1">{tJointCounsel("title")}</h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    {jointCounselStatus.supervisorName} — {tJointCounsel("pendingAcknowledgmentDescription")}
                  </p>
                  {jointCounselStatus.waiverText && (
                    <p className="text-xs text-muted-foreground italic mb-3">
                      {tJointCounsel("waiverTitle")}: {jointCounselStatus.waiverText}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => declineJointCounsel.mutate({ dealRoomId: dealId })}
                      disabled={declineJointCounsel.isPending}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-colors rounded-full"
                    >
                      <X className="w-4 h-4" />
                      {declineJointCounsel.isPending ? tJointCounsel("declining") : tJointCounsel("declineRequest")}
                    </button>
                    <button
                      onClick={() => acknowledgeJointCounsel.mutate({ dealRoomId: dealId })}
                      disabled={acknowledgeJointCounsel.isPending}
                      className="btn-brutal flex items-center gap-2 text-sm"
                    >
                      <Check className="w-4 h-4" />
                      {acknowledgeJointCounsel.isPending ? tJointCounsel("acknowledging") : tJointCounsel("acknowledgeRequest")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Acknowledged */}
          {jointCounselStatus?.acknowledgedAt && (
            <div className="card-brutal border-primary">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{tJointCounsel("jointCounselActive")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {jointCounselStatus.supervisorName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Declined — Initiator */}
          {jointCounselStatus?.declinedAt && jointCounselStatus.isInitiator && (
            <div className="card-brutal border-yellow-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow-500/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{tJointCounsel("title")}</h2>
                  <p className="text-sm text-muted-foreground">{tJointCounsel("declinedByOtherParty")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Declined — Other party */}
          {jointCounselStatus?.declinedAt && !jointCounselStatus.isInitiator && (
            <div className="card-brutal border-yellow-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow-500/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{tJointCounsel("title")}</h2>
                  <p className="text-sm text-muted-foreground">{tJointCounsel("youDeclinedJointCounsel")}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
