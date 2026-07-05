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
  Clock,
  ChevronDown,
  ChevronUp,
  Shield,
  Download,
  Loader2,
  UserCheck,
  XCircle,
  Info,
  Briefcase,
  History,
  Settings2,
} from "lucide-react";
import { resolveParamString } from "@/lib/parameters";
import { Badge } from "@/components/ui/badge";
import { VettingBadge } from "@/components/VettingBadge";
import { useContractMessages } from "@/lib/use-contract-messages";

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
  const contractLang = deal?.contractLanguage || "en";
  const messages = useContractMessages(contractLang);

  if (!messages) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-16"></div>
        <div className="card-brutal animate-pulse h-96"></div>
      </div>
    );
  }

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
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [showAttorneyModal, setShowAttorneyModal] = useState(false);
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<string>("");
  const [paramProposalForm, setParamProposalForm] = useState<{ parameterId: string; label: string } | null>(null);
  const [paramProposedValue, setParamProposedValue] = useState("");
  const [paramRationale, setParamRationale] = useState("");

  const { data: deal, isLoading: dealLoading } = trpc.deal.getById.useQuery({ id: dealId });
  const contractLang = deal?.contractLanguage || "en";

  // Only the heavy negotiation-state queries that we actually need on this
  // page; gating each on the deal status avoids a 7-query waterfall during
  // initial load. Worst-case cold-start of the review page is now bounded by
  // `getById` + `getCurrent`, not by every supporting query.
  const dealStatus = deal?.status;
  const needsNegotiationData =
    dealStatus === "NEGOTIATING" ||
    dealStatus === "AGREED" ||
    dealStatus === "SIGNING" ||
    dealStatus === "COMPLETED";

  const { data: suggestions, isLoading: suggestionsLoading, refetch } = trpc.compromise.getCurrent.useQuery(
    { dealRoomId: dealId },
    { enabled: needsNegotiationData },
  );
  const { data: satisfactionScores, refetch: refetchSatisfaction } = trpc.compromise.getSatisfactionScores.useQuery(
    { dealRoomId: dealId },
    { enabled: needsNegotiationData },
  );
  const { data: counterProposals, refetch: refetchCounterProposals } = trpc.compromise.getCounterProposals.useQuery(
    { dealRoomId: dealId },
    { enabled: dealStatus === "NEGOTIATING" },
  );
  const { data: history } = trpc.compromise.getHistory.useQuery(
    { dealRoomId: dealId },
    { enabled: needsNegotiationData && (deal?.currentRound ?? 0) > 1 },
  );
  const { data: parameterProposals, refetch: refetchParamProposals } = trpc.compromise.getParameterProposals.useQuery(
    { dealRoomId: dealId },
    { enabled: dealStatus === "NEGOTIATING" && !!deal?.parameters && Object.keys((deal.parameters as Record<string, string>) || {}).length > 0 },
  );
  const { data: validation } = trpc.compromise.getValidation.useQuery(
    { dealRoomId: dealId },
    { enabled: needsNegotiationData },
  );

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
      refetchSatisfaction();
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
      refetchSatisfaction();
    },
    onError: (error) => {
      toast.error(t("toastMessages.regenerateFailed", { error: error.message }));
    },
  });

  const respondToSuggestion = trpc.compromise.respond.useMutation({
    onSuccess: () => {
      refetch();
      refetchSatisfaction();
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
      refetchSatisfaction();
    },
    onError: (error) => {
      toast.error(t("toastMessages.respondFailed", { error: error.message }));
    },
  });

  const submitParameterProposal = trpc.compromise.proposeParameterChange.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.counterProposalSubmitted"));
      setParamProposalForm(null);
      setParamProposedValue("");
      setParamRationale("");
      refetchParamProposals();
    },
    onError: (error) => {
      toast.error(t("toastMessages.submitFailed", { error: error.message }));
    },
  });

  const respondToParameterProposal = trpc.compromise.respondToParameterProposal.useMutation({
    onSuccess: (data) => {
      if (data.accepted) {
        toast.success(t("toastMessages.counterProposalAccepted"));
      } else {
        toast.success(t("toastMessages.counterProposalRejected"));
      }
      refetchParamProposals();
      refetch(); // re-fetch deal data since parameter values may have changed
    },
    onError: (error) => {
      toast.error(t("toastMessages.respondFailed", { error: error.message }));
    },
  });

  // Render the page chrome as soon as `deal` resolves; only block on
  // `suggestionsLoading` for statuses that actually need a suggestion. For
  // DRAFT / AWAITING_RESPONSE this page has nothing useful to show — point
  // the user back to the deal detail instead of leaving them on a blank
  // skeleton.
  if (dealLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-16"></div>
        <div className="card-brutal animate-pulse h-96"></div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertCircle className="w-5 h-5" />
          <span>{t("failedToLoad")}</span>
        </div>
      </div>
    );
  }

  if (!needsNegotiationData) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{t("reviewCompromises")}</h1>
            <p className="text-sm text-muted-foreground">{deal.name}</p>
          </div>
        </div>
        <div className="card-brutal text-center py-10">
          <p className="text-muted-foreground">{t("notReadyForReview")}</p>
        </div>
      </div>
    );
  }

  if (suggestionsLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-16"></div>
        <div className="card-brutal animate-pulse h-96"></div>
      </div>
    );
  }

  if (!suggestions) {
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
  const allAgreed = suggestions.length > 0 && agreedCount === suggestions.length;

  const isInitiator = deal.currentUserRole === "INITIATOR";
  const isSoloMode = (deal as { dealMode?: string }).dealMode === "SOLO";
  const pendingCounterProposalsForMe = counterProposals?.pendingForMe || [];

  // Check if there are rejections that need new suggestions
  const hasRejections = suggestions.some((item) => {
    const suggestion = item.suggestion;
    if (!suggestion) return false;
    const myAccepted = isInitiator ? suggestion.partyAAccepted : suggestion.partyBAccepted;
    const otherAccepted = isInitiator ? suggestion.partyBAccepted : suggestion.partyAAccepted;
    return myAccepted === false || otherAccepted === false;
  });

  // Hand-off state: current user has finished their part of the back-and-forth
  // (accepted everything that needs accepting) and the other party still has
  // open decisions. Surface a "sit tight" banner so users aren't left wondering
  // what to do next.
  const myDecisionsMade = !needsGeneration && suggestions.every((item) => {
    if (item.status === "AGREED") return true;
    const suggestion = item.suggestion;
    if (!suggestion) return true;
    const myAccepted = isInitiator ? suggestion.partyAAccepted : suggestion.partyBAccepted;
    return myAccepted === true;
  });
  const otherStillPending = suggestions.some((item) => {
    if (item.status === "AGREED") return false;
    const suggestion = item.suggestion;
    if (!suggestion) return false;
    const otherAccepted = isInitiator ? suggestion.partyBAccepted : suggestion.partyAAccepted;
    return otherAccepted !== true;
  });
  const otherPartyName = (isInitiator
    ? deal.parties.find((p) => p.role === "RESPONDENT")?.name
    : deal.parties.find((p) => p.role === "INITIATOR")?.name) || t("otherParty");
  const waitingForOther =
    !isSoloMode &&
    !allAgreed &&
    !hasRejections &&
    pendingCounterProposalsForMe.length === 0 &&
    myDecisionsMade &&
    otherStillPending;

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
          {deal.lawyerVetting && (
            <VettingBadge vetting={deal.lawyerVetting} governingLaw={deal.governingLaw} compact />
          )}
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

      {/* Waiting-for-other-party banner — closes the silent "now what?"
          moment after a party has accepted the compromise but the other
          hasn't responded yet. */}
      {waitingForOther && (
        <div className="card-brutal border-primary/40 bg-primary/5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">
                {t("waitingForOtherTitle", { name: otherPartyName })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("waitingForOtherDescription")}
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Negotiation Outcome */}
      {satisfactionScores && !needsGeneration && (() => {
        const getLabel = (s: number) => s >= 85 ? t("satisfactionCloseToPreference") : s >= 65 ? t("satisfactionFavorable") : s >= 45 ? t("satisfactionBalanced") : s >= 25 ? t("satisfactionAccommodated") : t("satisfactionSignificantConcession");
        // Brand-aligned dark-theme palette — the previous cream/light
        // tokens (`bg-green-50` etc.) inverted poorly against the rest
        // of the app and stood out as off-brand.
        const getColor = (s: number) => s >= 85 ? "text-green-400 bg-green-500/10 border-green-500/30" : s >= 65 ? "text-primary bg-primary/10 border-primary/30" : s >= 45 ? "text-foreground bg-muted/50 border-border" : s >= 25 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" : "text-destructive bg-destructive/10 border-destructive/30";

        const myScores = isInitiator ? satisfactionScores.partyA : satisfactionScores.partyB;
        const theirScores = isInitiator ? satisfactionScores.partyB : satisfactionScores.partyA;

        return (
          <div className="card-brutal">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">{t("negotiationOutcome")}</span>
            </div>

            {/* Qualitative outcome labels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className={`p-4 rounded-xl border ${getColor(myScores.satisfaction)}`}>
                <p className="text-xs text-muted-foreground mb-1">{t("forYou")}</p>
                <p className="font-semibold">{getLabel(myScores.satisfaction)}</p>
              </div>
              <div className={`p-4 rounded-xl border ${getColor(theirScores.satisfaction)}`}>
                <p className="text-xs text-muted-foreground mb-1">{t("forThem")}</p>
                <p className="font-semibold">{getLabel(theirScores.satisfaction)}</p>
              </div>
            </div>

            {/* Negotiation summary */}
            <div className="p-4 bg-muted/30 rounded-xl border border-border">
              <p className="text-sm font-medium mb-2">{t("negotiationSummary")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("gotPreferenceLabel")}</span>
                  <p className="font-semibold">{t("clauseCount", { count: myScores.gotPreference, total: satisfactionScores.totalClauses })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("heldFirmLabel")}</span>
                  <p className="font-semibold">{t("clauseCountSimple", { count: myScores.firmClauses })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("showedOpennessLabel")}</span>
                  <p className="font-semibold">{t("clauseCountSimple", { count: myScores.openClauses })}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Negotiable Parameters */}
      {parameterProposals && parameterProposals.parameters.length > 0 && !needsGeneration && (
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold">{t("negotiableParameters")}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t("negotiableParametersDescription")}</p>

          <div className="space-y-4">
            {parameterProposals.parameters.map((param) => {
              const label = resolveParamString(param.label as string | Record<string, string>, contractLang, param.id);
              const pendingForMe = param.pendingForMe || [];
              const myProposals = param.myProposals || [];

              return (
                <div key={param.id} className="p-4 border border-border space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("currentValue", { value: param.currentValue || "—" })}
                      </p>
                    </div>
                    {!paramProposalForm && (
                      <button
                        onClick={() => {
                          setParamProposalForm({ parameterId: param.id, label });
                          setParamProposedValue("");
                          setParamRationale("");
                        }}
                        className="flex items-center gap-2 px-3 py-2 border border-muted-foreground text-muted-foreground hover:border-primary hover:text-primary transition-colors rounded-full text-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {t("proposeChange")}
                      </button>
                    )}
                  </div>

                  {/* Incoming proposals for this param */}
                  {pendingForMe.map((pp) => (
                    <div key={pp.id} className="p-3 border border-yellow-500/30 bg-yellow-500/10 space-y-2">
                      <p className="text-sm font-medium text-yellow-200">
                        {t("incomingParameterProposal", { label })}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{t("parameterProposalFrom", { value: pp.currentValue })}</span>
                        <span className="font-semibold text-primary">{t("parameterProposalTo", { value: pp.proposedValue })}</span>
                      </div>
                      {pp.rationale && (
                        <div className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-200">&quot;{pp.rationale}&quot;</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => respondToParameterProposal.mutate({ proposalId: pp.id, accept: false })}
                          disabled={respondToParameterProposal.isPending}
                          className="flex items-center gap-2 px-3 py-2 border border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-colors rounded-full text-sm"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          {t("reject")}
                        </button>
                        <button
                          onClick={() => respondToParameterProposal.mutate({ proposalId: pp.id, accept: true })}
                          disabled={respondToParameterProposal.isPending}
                          className="btn-brutal flex items-center gap-2 text-sm"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          {t("accept")}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* My proposals for this param */}
                  {myProposals.map((pp) => (
                    <div key={pp.id} className="p-3 border border-blue-500/30 bg-blue-500/5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-blue-300">
                          {t("yourParameterProposal", { label })}
                        </p>
                        <Badge
                          className={
                            pp.status === "ACCEPTED" ? "bg-green-500/20 text-green-400" :
                            pp.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                            "bg-yellow-500/20 text-yellow-400"
                          }
                        >
                          {pp.status === "ACCEPTED" ? t("accepted") :
                           pp.status === "REJECTED" ? t("rejected") :
                           t("counterProposalPending")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{t("parameterProposalFrom", { value: pp.currentValue })}</span>
                        <span className="font-semibold">{t("parameterProposalTo", { value: pp.proposedValue })}</span>
                      </div>
                      {pp.rationale && (
                        <div className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-200">&quot;{pp.rationale}&quot;</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Inline proposal form */}
                  {paramProposalForm?.parameterId === param.id && (
                    <div className="p-3 border border-primary/30 bg-primary/5 space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">{t("proposedValueLabel")}</label>
                        <input
                          type={param.type === "percentage" || param.type === "number" || param.type === "currency" ? "text" : "text"}
                          value={paramProposedValue}
                          onChange={(e) => setParamProposedValue(e.target.value)}
                          placeholder={t("proposedValuePlaceholder")}
                          className="w-full p-2 bg-background border border-border focus:border-primary outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t("parameterRationale")}</label>
                        <textarea
                          value={paramRationale}
                          onChange={(e) => setParamRationale(e.target.value)}
                          placeholder={t("parameterRationalePlaceholder")}
                          className="w-full p-2 bg-background border border-border focus:border-primary outline-none resize-none h-16 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setParamProposalForm(null);
                            setParamProposedValue("");
                            setParamRationale("");
                          }}
                          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          {tCommon("cancel")}
                        </button>
                        <button
                          onClick={() => {
                            if (!paramProposedValue.trim()) return;
                            submitParameterProposal.mutate({
                              dealRoomId: dealId,
                              parameterId: param.id,
                              proposedValue: paramProposedValue.trim(),
                              rationale: paramRationale.trim() || undefined,
                            });
                          }}
                          disabled={!paramProposedValue.trim() || submitParameterProposal.isPending}
                          className="btn-brutal text-sm disabled:opacity-50"
                        >
                          {submitParameterProposal.isPending ? t("generating") : t("submitParameterProposal")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Parameter history events */}
            {(() => {
              const paramEvents = history?.events.filter((e) => e.clauseId === "") || [];
              if (paramEvents.length === 0) return null;
              return (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    {t("negotiationHistory")}
                  </p>
                  <div className="space-y-2">
                    {paramEvents.map((event, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-purple-400" />
                        <div>
                          <span className="text-foreground">
                            {event.type === "parameter_proposed" && t("historyParameterProposed", { party: event.party === "you" ? t("historyYou") : t("historyThem"), param: event.clauseTitle, from: event.parameterFrom || "", to: event.parameterTo || "" })}
                            {event.type === "parameter_accepted" && t("historyParameterAccepted", { party: event.party === "you" ? t("historyYou") : t("historyThem"), param: event.clauseTitle })}
                            {event.type === "parameter_rejected" && t("historyParameterRejected", { party: event.party === "you" ? t("historyYou") : t("historyThem"), param: event.clauseTitle })}
                          </span>
                          {event.rationale && (
                            <p className="mt-0.5 pl-2 border-l-2 border-muted-foreground/30 italic">{event.rationale}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
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
                className="p-2.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
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

            // My sent counter-proposals for this clause
            const myCounterProposals = counterProposals?.fromMe.filter(
              (cp) => cp.dealRoomClauseId === item.clauseId
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
                  {/* Only render the collapse toggle when there's actually
                      something extra to show — the expanded block at the
                      bottom is gated on `suggestion`, so without one the
                      chevron does nothing visible. */}
                  {suggestion && (
                    <button
                      onClick={() => setExpandedClause(isExpanded ? null : item.clauseId)}
                      className="p-2.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  )}
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
                          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20">
                            <MessageSquare className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-200">
                              &quot;{cp.rationale}&quot;
                            </p>
                          </div>
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

                {/* My Sent Counter-Proposals */}
                {myCounterProposals.length > 0 && (
                  <div className="mb-4 p-4 border border-blue-500/30 bg-blue-500/5">
                    <p className="text-sm font-medium text-blue-300 mb-3">
                      {t("yourCounterProposal")}
                    </p>
                    {myCounterProposals.map((cp) => (
                      <div key={cp.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{cp.proposedOption.label}</p>
                          <Badge
                            className={
                              cp.status === "ACCEPTED" ? "bg-green-500/20 text-green-400" :
                              cp.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                              "bg-yellow-500/20 text-yellow-400"
                            }
                          >
                            {cp.status === "ACCEPTED" ? t("accepted") :
                             cp.status === "REJECTED" ? t("rejected") :
                             t("counterProposalPending")}
                          </Badge>
                        </div>
                        {cp.rationale && (
                          <div className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-200">
                              &quot;{cp.rationale}&quot;
                            </p>
                          </div>
                        )}
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

                    {/* Outcome for this clause */}
                    {(() => {
                      const yourScore = isInitiator ? suggestion.satisfactionPartyA : suggestion.satisfactionPartyB;
                      const theirScore = isInitiator ? suggestion.satisfactionPartyB : suggestion.satisfactionPartyA;
                      const getLabel = (s: number) => s >= 85 ? t("satisfactionCloseToPreference") : s >= 65 ? t("satisfactionFavorable") : s >= 45 ? t("satisfactionBalanced") : s >= 25 ? t("satisfactionAccommodated") : t("satisfactionSignificantConcession");
                      const getColor = (s: number) => s >= 85 ? "bg-green-500/10 text-green-400" : s >= 65 ? "bg-primary/10 text-primary" : s >= 45 ? "bg-muted text-foreground" : s >= 25 ? "bg-yellow-500/10 text-yellow-400" : "bg-destructive/10 text-destructive";
                      return (
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getColor(yourScore)}`}>
                            {t("forYou")}: {getLabel(yourScore)}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getColor(theirScore)}`}>
                            {t("forThem")}: {getLabel(theirScore)}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Expandable Pros/Cons Analysis for suggested option */}
                    {suggestion.suggestedOption && (
                      <div className="mb-4 border border-border">
                        <button
                          onClick={() => setExpandedAnalysis(expandedAnalysis === item.clauseId ? null : item.clauseId)}
                          className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            {t("optionAnalysis")}
                          </span>
                          {expandedAnalysis === item.clauseId
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div
                          className="grid transition-[grid-template-rows] duration-300 ease-out"
                          style={{ gridTemplateRows: expandedAnalysis === item.clauseId ? "1fr" : "0fr" }}
                        >
                          <div className="overflow-hidden">
                            <div className="px-3 pb-3 space-y-3">
                              {suggestion.suggestedOption.plainDescription && (
                                <p className="text-sm text-muted-foreground">
                                  {suggestion.suggestedOption.plainDescription}
                                </p>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                                    {t("prosForYou")}
                                  </p>
                                  <ul className="space-y-1">
                                    {(isInitiator
                                      ? suggestion.suggestedOption.prosPartyA
                                      : suggestion.suggestedOption.prosPartyB
                                    ).map((pro: string, i: number) => (
                                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                        <span className="text-primary">+</span>
                                        {pro}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-warning uppercase tracking-wider mb-2">
                                    {t("consForYou")}
                                  </p>
                                  <ul className="space-y-1">
                                    {(isInitiator
                                      ? suggestion.suggestedOption.consPartyA
                                      : suggestion.suggestedOption.consPartyB
                                    ).map((con: string, i: number) => (
                                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                        <span className="text-warning">-</span>
                                        {con}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expandable Negotiation History for this clause */}
                    {(() => {
                      const clauseEvents = history?.events.filter((e) => e.clauseId === item.clauseId) || [];
                      if (clauseEvents.length === 0) return null;
                      return (
                        <div className="mb-4 border border-border">
                          <button
                            onClick={() => setExpandedHistory(expandedHistory === item.clauseId ? null : item.clauseId)}
                            className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <History className="w-4 h-4" />
                              {t("negotiationHistory")}
                              <Badge variant="outline" className="text-xs">{clauseEvents.length}</Badge>
                            </span>
                            {expandedHistory === item.clauseId
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <div
                            className="grid transition-[grid-template-rows] duration-300 ease-out"
                            style={{ gridTemplateRows: expandedHistory === item.clauseId ? "1fr" : "0fr" }}
                          >
                            <div className="overflow-hidden">
                              <div className="px-3 pb-3">
                                <div className="relative pl-6 space-y-0">
                                  {/* Vertical timeline line */}
                                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                                  {clauseEvents.map((event, idx) => {
                                    const partyLabel = event.party === "you" ? t("historyYou") : t("historyThem");
                                    let dotColor = "bg-muted-foreground";
                                    let message = "";

                                    switch (event.type) {
                                      case "compromise_generated":
                                        dotColor = "bg-primary";
                                        message = t("historyCompromiseGenerated", { option: event.optionLabel || "" });
                                        break;
                                      case "compromise_accepted":
                                        dotColor = "bg-green-500";
                                        message = t("historyAccepted", { party: partyLabel, option: event.optionLabel || "" });
                                        break;
                                      case "compromise_rejected":
                                        dotColor = "bg-yellow-500";
                                        message = t("historyRejected", { party: partyLabel, option: event.optionLabel || "" });
                                        break;
                                      case "counter_proposal":
                                        dotColor = "bg-blue-500";
                                        message = t("historyCounterProposal", { party: partyLabel, option: event.optionLabel || "" });
                                        break;
                                      case "counter_accepted":
                                        dotColor = "bg-green-500";
                                        message = t("historyCounterAccepted", { party: partyLabel, option: event.optionLabel || "" });
                                        break;
                                      case "counter_rejected":
                                        dotColor = "bg-red-500";
                                        message = t("historyCounterRejected", { party: partyLabel, option: event.optionLabel || "" });
                                        break;
                                      case "parameter_proposed":
                                        dotColor = "bg-purple-500";
                                        message = t("historyParameterProposed", { party: partyLabel, param: event.clauseTitle, from: event.parameterFrom || "", to: event.parameterTo || "" });
                                        break;
                                      case "parameter_accepted":
                                        dotColor = "bg-green-500";
                                        message = t("historyParameterAccepted", { party: partyLabel, param: event.clauseTitle });
                                        break;
                                      case "parameter_rejected":
                                        dotColor = "bg-red-500";
                                        message = t("historyParameterRejected", { party: partyLabel, param: event.clauseTitle });
                                        break;
                                    }

                                    return (
                                      <div key={idx} className="relative pb-3 last:pb-0">
                                        {/* Timeline dot */}
                                        <div className={`absolute -left-6 top-1.5 w-[9px] h-[9px] rounded-full ${dotColor} ring-2 ring-background`} />
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-muted-foreground">
                                              {t("historyRoundLabel", { number: event.roundNumber })}
                                            </span>
                                          </div>
                                          <p className="text-sm">{message}</p>
                                          {event.rationale && (
                                            <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2 mt-1">
                                              {t("historyRationale")} &quot;{event.rationale}&quot;
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
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
          <div className="card-brutal max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{t("selectReviewingAttorney")}</h2>
              <button
                onClick={() => {
                  setShowAttorneyModal(false);
                  setSelectedAttorneyId("");
                }}
                className="p-2.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
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
          {/* Download Your Contract — always shown first */}
          <div className="card-brutal border-primary/50 bg-primary/5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/20 flex items-center justify-center flex-shrink-0 rounded-2xl">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">{t("downloadContract")}</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("downloadContractDescription")}
                </p>
                <DownloadLinks dealId={dealId} />
              </div>
            </div>
          </div>

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
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowAttorneyModal(true)}
                        className="btn-brutal-outline inline-flex items-center gap-2 text-sm"
                      >
                        <Shield className="w-4 h-4" />
                        {t("requestYourOwnReview")}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {t("attorneyReviewPriceNote", { price: contractLang === "es" ? "200 €" : "$200" })}
                      </p>
                    </div>
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
            <div className="card-brutal border-primary text-center py-6">
              <Check className="w-8 h-8 text-primary mx-auto mb-3" />
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
              {!reviewStatus.myReview && !reviewStatus.suppressReviewForInitiator && (
                <p className="text-xs text-muted-foreground mt-4">
                  {t("attorneyReviewPriceNote", { price: contractLang === "es" ? "200 €" : "$200" })}
                </p>
              )}
            </div>
          )}

          {/* Reviews active — signing blocked */}
          {!reviewStatus?.canProceedToSigning && !reviewStatus?.myReview && !reviewStatus?.otherPartyReviewActive && (
            <div className="card-brutal border-primary text-center py-6">
              <Check className="w-8 h-8 text-primary mx-auto mb-3" />
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
              {!reviewStatus?.suppressReviewForInitiator && (
                <p className="text-xs text-muted-foreground mt-4">
                  {t("attorneyReviewPriceNote", { price: contractLang === "es" ? "200 €" : "$200" })}
                </p>
              )}
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
              <div className="card-brutal max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold">{tJointCounsel("selectCounsel")}</h2>
                  <button
                    onClick={() => {
                      setShowJointCounselModal(false);
                      setSelectedJointCounselId("");
                    }}
                    className="p-2.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
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
