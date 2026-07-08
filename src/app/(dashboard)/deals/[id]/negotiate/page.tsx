"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Sliders,
  Copy,
  List,
  ChevronsRight,
  Loader2,
  UserPlus,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle } from "lucide-react";
import { interpolateParameters, type ParameterSchema } from "@/lib/parameters";
import { LawyerWarningModal } from "@/components/LawyerWarningModal";
import { VettingBadge } from "@/components/VettingBadge";
import { useContractMessages } from "@/lib/use-contract-messages";

type GoverningLaw = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";

interface JurisdictionRule {
  available: boolean;
  warning?: string;
  note?: string;
}

// Raw DB form — warning/note may be localized {en, es} objects
interface RawJurisdictionRule {
  available: boolean;
  warning?: string | Record<string, string>;
  note?: string | Record<string, string>;
}

interface JurisdictionConfig {
  CALIFORNIA?: RawJurisdictionRule;
  ENGLAND_WALES?: RawJurisdictionRule;
  SPAIN?: RawJurisdictionRule;
}

const governingLawTKey: Record<GoverningLaw, string> = {
  CALIFORNIA: "california",
  ENGLAND_WALES: "englandWales",
  SPAIN: "spain",
};

interface Selection {
  dealRoomClauseId: string;
  optionId: string;
  priority: number;
  flexibility: number;
}

/** Outer wrapper: determines contract language and provides correct locale */
export default function NegotiatePage() {
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
      <NegotiateContent dealId={dealId} />
    </NextIntlClientProvider>
  );
}

/** Inner component: all UI and hooks, picks up contract locale from provider */
function NegotiateContent({ dealId }: { dealId: string }) {
  const router = useRouter();
  const t = useTranslations("negotiate");
  const tCommon = useTranslations("common");
  const tNewDeal = useTranslations("newDeal");

  const { data: session } = useSession();
  const isLawyer = session?.user?.role === "LAWYER";

  const [currentClauseIndex, setCurrentClauseIndex] = useState(0);
  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  // Value intentionally unread: only the reset side of this state is used today.
  const [_showProsConsFor, setShowProsConsFor] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: deal, isLoading, error, refetch: refetchDeal } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: existingSelections } = trpc.selections.getMySelections.useQuery({ dealRoomId: dealId });

  // Cloud Intelligence: quality scores for current clause options
  const currentClauseData = deal?.clauses[currentClauseIndex];
  const { data: qualityScores } = trpc.compromise.getQualityScores.useQuery(
    {
      dealRoomId: dealId,
      clauseTemplateId: currentClauseData?.clauseTemplate?.id || "",
      optionIds: currentClauseData?.clauseTemplate?.options?.map((o: { id: string }) => o.id) || [],
    },
    { enabled: !!currentClauseData?.clauseTemplate?.id }
  );
  const qualityMap = new Map(qualityScores?.map((q) => [q.optionId, q]) || []);

  const isSoloMode = deal?.dealMode === "SOLO";

  // Cloud Intelligence: satisfaction prediction (only when both parties have selections)
  const { data: prediction } = trpc.compromise.predictSatisfaction.useQuery(
    { dealRoomId: dealId },
    { enabled: !isSoloMode }
  );

  // Parameter interpolation helper
  const paramSchema = deal?.contractTemplate?.parameterSchema as ParameterSchema | null | undefined;
  const dealParams = deal?.parameters as Record<string, string> | undefined;
  const interpolateLegalText = (text: string, clauseId: string) => {
    if (!paramSchema?.parameters?.length || !dealParams) return text;
    return interpolateParameters(text, dealParams, paramSchema, clauseId, deal?.contractLanguage || "en");
  };

  // Check if the user is a respondent and if counterparty selections are available
  const isRespondent = deal?.currentUserRole === "RESPONDENT";
  const initiatorParty = deal?.parties.find((p) => p.role === "INITIATOR");
  const hasInitiatorSubmitted = initiatorParty?.status === "SUBMITTED" ||
                                initiatorParty?.status === "REVIEWING" ||
                                initiatorParty?.status === "ACCEPTED";
  const canPrePopulate = isRespondent && hasInitiatorSubmitted;

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedVisible, setSavedVisible] = useState(false);
  const saveSelections = trpc.selections.bulkSave.useMutation({
    onSuccess: () => {
      setLastSavedAt(new Date());
      setSavedVisible(true);
    },
  });

  useEffect(() => {
    if (!savedVisible) return;
    const timer = setTimeout(() => setSavedVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [savedVisible, lastSavedAt]);
  const submitSelections = trpc.deal.submitSelections.useMutation({
    onSuccess: (result) => {
      if (result.soloCompleted) {
        toast.success(t("soloDocumentGenerated"));
        router.push(`/deals/${dealId}`);
      } else if (result.bothSubmitted) {
        toast.success(t("toastMessages.bothPartiesSubmitted"));
        router.push(`/deals/${dealId}/review`);
      } else {
        toast.success(t("toastMessages.selectionsSubmitted"));
        router.push(`/deals/${dealId}`);
      }
    },
    onError: (error) => {
      toast.error(t("toastMessages.submitFailed", { error: error.message }));
    },
  });

  // Pre-populate from counterparty selections
  const { refetch: fetchCounterpartySelections, isFetching: isPrePopulating } = trpc.selections.getCounterpartySelections.useQuery(
    { dealRoomId: dealId },
    { enabled: false } // Only fetch on demand
  );

  const handlePrePopulate = async () => {
    try {
      const result = await fetchCounterpartySelections();
      if (result.data) {
        const map = new Map<string, Selection>();
        for (const sel of result.data) {
          map.set(sel.dealRoomClauseId, {
            dealRoomClauseId: sel.dealRoomClauseId,
            optionId: sel.optionId,
            priority: 3, // Default priority
            flexibility: 3, // Default flexibility
          });
        }
        setSelections(map);
        toast.success(t("toastMessages.prePopulated"));
      }
    } catch {
      toast.error(t("toastMessages.prePopulateFailed"));
    }
  };

  // Load existing selections
  useEffect(() => {
    if (existingSelections) {
      const map = new Map<string, Selection>();
      for (const sel of existingSelections) {
        map.set(sel.dealRoomClauseId, {
          dealRoomClauseId: sel.dealRoomClauseId,
          optionId: sel.optionId,
          priority: sel.priority,
          flexibility: sel.flexibility,
        });
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates local draft state from the fetched selections query; deriving during render would restructure the draft-editing flow
      setSelections(map);
    }
  }, [existingSelections]);

  // Scroll to top whenever the active clause changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentClauseIndex]);

  // Once a deal leaves the negotiable window, the only sensible
  // place to be is the deal hub. Redirect rather than render stale
  // negotiate UI that the user can no longer act on.
  const dealStatus = deal?.status;
  useEffect(() => {
    if (
      dealStatus === "SIGNING" ||
      dealStatus === "COMPLETED" ||
      dealStatus === "CANCELLED"
    ) {
      router.replace(`/deals/${dealId}`);
    }
  }, [dealStatus, dealId, router]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-16"></div>
        <div className="card-brutal animate-pulse h-96"></div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="card-brutal border-warning">
        <div className="flex items-center gap-3 text-warning">
          <AlertCircle className="w-5 h-5" />
          <span>{t("failedToLoad", { error: error?.message || "Not found" })}</span>
        </div>
      </div>
    );
  }

  // Render guard paired with the redirect useEffect above — prevents
  // a flash of stale negotiate UI while the route transition is pending.
  if (
    deal.status === "SIGNING" ||
    deal.status === "COMPLETED" ||
    deal.status === "CANCELLED"
  ) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="card-brutal animate-pulse h-16" />
      </div>
    );
  }

  const clauses = deal.clauses;
  const currentClause = clauses[currentClauseIndex];
  const currentSelection = selections.get(currentClause.id);
  const progress = Math.round((selections.size / clauses.length) * 100);
  const isComplete = selections.size === clauses.length;
  const governingLaw = deal.governingLaw as GoverningLaw;
  const contractLang = (deal as { contractLanguage?: string }).contractLanguage || "en";

  // Lawyer warning modal — hidden for users with LAWYER role
  const myNegotiateParty = deal.parties.find((p) => p.id === deal.currentPartyId);
  const showLawyerWarning = !isLawyer &&
    !deal.lawyerVettingId &&
    !myNegotiateParty?.lawyerWarningDismissedAt &&
    ["DRAFT", "AWAITING_RESPONSE", "NEGOTIATING"].includes(deal.status);

  // Detect already-submitted state
  const currentParty = deal.parties.find((p) => p.id === deal.currentPartyId);
  const isAlreadySubmitted = currentParty?.status === "SUBMITTED" || currentParty?.status === "REVIEWING" || currentParty?.status === "ACCEPTED";
  const isInitiator = deal.currentUserRole === "INITIATOR";
  const respondentParty = deal.parties.find((p) => p.role === "RESPONDENT");
  const hasRespondent = !!respondentParty?.userId;
  const respondentSubmitted = respondentParty?.status === "SUBMITTED" || respondentParty?.status === "REVIEWING" || respondentParty?.status === "ACCEPTED";
  const bothSubmitted = isAlreadySubmitted && respondentSubmitted;

  // Resolve a potentially localized string ({en, es} object or plain string)
  const resolveLocalized = (value: string | Record<string, string> | undefined): string | undefined => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value[contractLang] || value["en"] || Object.values(value)[0];
  };

  // Helper to get jurisdiction rules for an option (resolves i18n)
  const getJurisdictionRules = (option: { jurisdictionConfig?: unknown }): JurisdictionRule | null => {
    if (!option.jurisdictionConfig) return null;
    const config = option.jurisdictionConfig as JurisdictionConfig;
    const raw = config[governingLaw];
    if (!raw) return null;
    return {
      available: raw.available,
      warning: resolveLocalized(raw.warning),
      note: resolveLocalized(raw.note),
    };
  };

  // Filter out unavailable options for this jurisdiction
  const availableOptions = currentClause.clauseTemplate.options.filter((option) => {
    const rules = getJurisdictionRules(option);
    return !rules || rules.available !== false;
  });

  // Check if current selection is no longer available (edge case)
  const currentSelectionUnavailable = currentSelection && !availableOptions.find(
    (opt) => opt.id === currentSelection.optionId
  );

  const handleOptionSelect = (optionId: string) => {
    const existing = selections.get(currentClause.id);
    setSelections(new Map(selections.set(currentClause.id, {
      dealRoomClauseId: currentClause.id,
      optionId,
      priority: existing?.priority || 3,
      flexibility: existing?.flexibility || 3,
    })));
  };

  const handleFirmnessChange = (value: number[]) => {
    const existing = selections.get(currentClause.id);
    if (existing) {
      setSelections(new Map(selections.set(currentClause.id, {
        ...existing,
        flexibility: 6 - value[0], // firmness 5 (firm) = flexibility 1, firmness 1 (open) = flexibility 5
      })));
    }
  };

  const handleSaveAndContinue = async () => {
    // Auto-save current selections
    const selectionsArray = Array.from(selections.values());
    if (selectionsArray.length > 0) {
      try {
        await saveSelections.mutateAsync({
          dealRoomId: dealId,
          selections: selectionsArray,
        });
      } catch {
        // Silent save, don't block navigation
      }
    }

    if (currentClauseIndex < clauses.length - 1) {
      setCurrentClauseIndex(currentClauseIndex + 1);
      setExpandedOption(null);
      setShowProsConsFor(null);
    }
  };

  const handleSkipToSubmit = async () => {
    const selectionsArray = Array.from(selections.values());
    if (selectionsArray.length > 0) {
      try {
        await saveSelections.mutateAsync({
          dealRoomId: dealId,
          selections: selectionsArray,
        });
      } catch {
        // Silent save failure — don't block navigation
      }
    }
    setCurrentClauseIndex(clauses.length - 1);
    setExpandedOption(null);
    setShowProsConsFor(null);
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      toast.error(t("toastMessages.pleaseSelectAll"));
      return;
    }

    // Save first, then submit
    const selectionsArray = Array.from(selections.values());
    await saveSelections.mutateAsync({
      dealRoomId: dealId,
      selections: selectionsArray,
    });

    submitSelections.mutate({ dealRoomId: dealId });
  };

  // Group clauses by category for sidebar
  const categories = Array.from(new Set(clauses.map(c => c.clauseTemplate.category)));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-3 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-heading break-words">{deal.name}</h1>
            <p className="text-sm text-muted-foreground">
              {deal.contractTemplate.displayName} • {t("clause")} <span className="metric text-foreground">{currentClauseIndex + 1}</span> {t("of")} <span className="metric">{clauses.length}</span>
            </p>
          </div>
          {deal.lawyerVetting && (
            <VettingBadge vetting={deal.lawyerVetting} governingLaw={deal.governingLaw} compact />
          )}
        </div>
        <div className="flex items-center gap-4">
          {(saveSelections.isPending || savedVisible) && (
            <div
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-500"
              aria-live="polite"
            >
              {saveSelections.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t("saveIndicator.saving")}</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3 text-primary" />
                  <span>{t("saveIndicator.saved")}</span>
                </>
              )}
            </div>
          )}
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{t("progress")}</p>
            <p className="metric"><span className="text-primary">{selections.size}</span><span className="text-muted-foreground">/{clauses.length}</span></p>
          </div>
          <Progress value={progress} className="hidden sm:block w-32 h-1.5" />
        </div>
      </div>

      {/* Respondent context banner — counterparty already submitted, selections are made independently */}
      {canPrePopulate && (
        <div className="mb-4 flex items-start gap-2 text-sm text-muted-foreground" role="status">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
          <p>{t("counterpartyAlreadySubmitted")}</p>
        </div>
      )}

      {/* Pre-populate checkbox - only visible for respondents when initiator has submitted */}
      {canPrePopulate && selections.size === 0 && (
        <div className="card-brutal mb-6 border-primary/30 bg-primary/5">
          <label className="flex items-start gap-3 cursor-pointer">
            <button
              onClick={handlePrePopulate}
              disabled={isPrePopulating}
              className="flex items-center gap-3 w-full text-left"
            >
              <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <Copy className="w-3 h-3 text-primary" />
              </div>
              <div>
                <p className="font-semibold">
                  {isPrePopulating ? t("prePopulateLoading") : t("prePopulate")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("prePopulateDescription")}
                </p>
              </div>
            </button>
          </label>
        </div>
      )}

      {/* All-Clauses-Selected banner — sticky reminder that lets the user
          jump straight to submit without scrolling. Persists across all
          clauses (not just when they're not on the last one), so the
          user always sees the affordance once they're done picking. */}
      {isComplete && !isAlreadySubmitted && (
        <div className="card-brutal mb-6 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{t("allClausesSelected")}</p>
              <p className="text-sm text-muted-foreground">{t("allClausesSelectedDescription")}</p>
            </div>
            <button
              onClick={handleSkipToSubmit}
              disabled={saveSelections.isPending}
              className="btn-brutal flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
            >
              {saveSelections.isPending ? t("saving") : t("skipToSubmit")}
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Already submitted banner */}
      {isAlreadySubmitted && currentClauseIndex === clauses.length - 1 && (
        <div className="card-brutal mb-6 border-primary bg-primary/5">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("alreadySubmitted")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {bothSubmitted
                  ? t("alreadySubmittedBothDone")
                  : isInitiator && !hasRespondent
                  ? t("alreadySubmittedInvite")
                  : t("alreadySubmittedWaiting")
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sidebar FAB */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-6 left-6 z-20 md:hidden w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg"
      >
        <List className="w-5 h-5" />
      </button>

      <div className="flex gap-6">
        {/* Sidebar - Clause Navigation */}
        {/* Mobile overlay sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/95 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="p-6 pt-8 overflow-y-auto h-full max-h-[100dvh] overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <p className="section-label text-primary">{t("clauses")}</p>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-3 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              {categories.map((category) => (
                <div key={category} className="mb-4">
                  <p className="section-label text-primary mb-2">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {clauses
                      .filter((c) => c.clauseTemplate.category === category)
                      .map((clause) => {
                        const globalIdx = clauses.indexOf(clause);
                        const isSelected = selections.has(clause.id);
                        const isCurrent = globalIdx === currentClauseIndex;

                        return (
                          <button
                            key={clause.id}
                            onClick={() => {
                              setCurrentClauseIndex(globalIdx);
                              setExpandedOption(null);
                              setSidebarOpen(false);
                            }}
                            className={`
                              w-full text-left px-3 py-2.5 text-sm flex items-center gap-2
                              rounded-xl transition-colors
                              ${isCurrent
                                ? "bg-primary/10 text-primary"
                                : isSelected
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                              }
                            `}
                          >
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                            )}
                            <span className="truncate">{clause.clauseTemplate.title}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden md:block w-72 sticky top-28 self-start space-y-4">
          {categories.map((category) => (
            <div key={category}>
              <p className="section-label text-primary mb-2">
                {category}
              </p>
              <div className="space-y-1">
                {clauses
                  .filter((c) => c.clauseTemplate.category === category)
                  .map((clause) => {
                    const globalIdx = clauses.indexOf(clause);
                    const isSelected = selections.has(clause.id);
                    const isCurrent = globalIdx === currentClauseIndex;

                    return (
                      <button
                        key={clause.id}
                        onClick={() => {
                          setCurrentClauseIndex(globalIdx);
                          setExpandedOption(null);
                        }}
                        className={`
                          w-full text-left px-3 py-2.5 text-sm flex items-center gap-2
                          rounded-xl transition-colors
                          ${isCurrent
                            ? "bg-primary/10 text-primary"
                            : isSelected
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          }
                        `}
                      >
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                        )}
                        <span className="truncate">{clause.clauseTemplate.title}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </aside>

        {/* Main Content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Clause Header */}
          <div className="card-brutal">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline" className="mb-2">{currentClause.clauseTemplate.category}</Badge>
                <h2 className="text-xl font-heading">{currentClause.clauseTemplate.title}</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {currentClause.clauseTemplate.isRequired ? tCommon("required") : tCommon("optional")}
              </span>
            </div>
            <p className="mt-4 text-muted-foreground">
              {currentClause.clauseTemplate.plainDescription}
            </p>
            {currentClause.clauseTemplate.legalContext && (
              <div className="mt-4 p-4 bg-muted/50 border border-border rounded-xl">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    {currentClause.clauseTemplate.legalContext}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-label">
                {t("selectPreferredOption")}
              </p>
              <Badge variant="outline" className="text-xs">
                {tNewDeal(`jurisdictions.${governingLawTKey[governingLaw]}`)}
              </Badge>
            </div>

            {/* Warning if current selection became unavailable */}
            {currentSelectionUnavailable && (
              <div className="p-3 border border-warning/50 bg-warning/10 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-sm text-warning">
                  {t("previousSelectionUnavailable", { law: tNewDeal(`jurisdictions.${governingLawTKey[governingLaw]}`) })}
                </p>
              </div>
            )}

            {availableOptions.map((option) => {
              const isSelected = currentSelection?.optionId === option.id;
              const isExpanded = expandedOption === option.id;
              const jurisdictionRules = getJurisdictionRules(option);
              const hasWarning = jurisdictionRules?.warning;
              const hasNote = jurisdictionRules?.note;
              const quality = qualityMap.get(option.id);

              return (
                <div
                  key={option.id}
                  className={`
                    card-brutal cursor-pointer transition-all
                    ${isSelected ? "border-primary/50 bg-primary/5" : "hover:border-muted-foreground"}
                    ${hasWarning ? "border-l-4 border-l-warning" : ""}
                  `}
                  onClick={() => handleOptionSelect(option.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {/* Radio circle — sized for mobile tap target (Apple HIG ~44pt minimum reached via parent card padding). */}
                      <div className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                        ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}
                      `}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-heading text-base">{option.label}</p>
                          {/* Cloud Intelligence quality badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            quality?.score != null && quality.score >= 70
                              ? "bg-green-500/10 text-green-600"
                              : quality?.score != null && quality.score >= 40
                                ? "bg-amber-500/10 text-amber-600"
                                : quality?.score != null
                                  ? "bg-red-500/10 text-red-600"
                                  : "bg-secondary text-muted-foreground"
                          }`}>
                            {quality?.score != null ? `${quality.score}` : t("unverified")}
                          </span>
                          {hasWarning && (
                            <AlertTriangle className="w-4 h-4 text-warning" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.plainDescription}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedOption(isExpanded ? null : option.id);
                      }}
                      className="p-3 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Jurisdiction indicator (compact) */}
                  {(hasWarning || hasNote) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs">
                      {hasWarning ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-px" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-px" />
                      )}
                      <span className={hasWarning ? "text-warning/80" : "text-blue-400/80"}>
                        {hasWarning ? jurisdictionRules.warning : jurisdictionRules.note}
                        {hasWarning && hasNote && <> — {jurisdictionRules.note}</>}
                      </span>
                    </div>
                  )}

                  {/* Expandable detail with CSS Grid animation */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-4 mt-4 border-t border-border space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* Pros/Cons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                              {isSoloMode
                                ? t("soloAdvantages")
                                : t("prosForYou")}
                            </p>
                            <ul className="space-y-1">
                              {(isSoloMode ? option.prosPartyA : (deal.currentUserRole === "INITIATOR" ? option.prosPartyA : option.prosPartyB)).map((pro, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="text-primary">+</span>
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-warning uppercase tracking-wider mb-2">
                              {isSoloMode
                                ? t("soloConsiderations")
                                : t("consForYou")}
                            </p>
                            <ul className="space-y-1">
                              {(isSoloMode ? option.consPartyA : (deal.currentUserRole === "INITIATOR" ? option.consPartyA : option.consPartyB)).map((con, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="text-warning">-</span>
                                  {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Legal Text Preview */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("legalText")}</p>
                          <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 border border-border rounded-xl">
                            {interpolateLegalText(option.legalText, currentClause.clauseTemplate.clauseId)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Firmness (hidden in solo mode) */}
          {currentSelection && !isSoloMode && (
            <div className="card-brutal space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-muted-foreground" />
                <span className="section-label">
                  {t("firmnessSettings")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("firmness")}</p>
                  <p className="text-xs text-muted-foreground">{t("firmnessDescription")}</p>
                </div>
                <span className="text-sm font-medium">{6 - currentSelection.flexibility}/5</span>
              </div>
              <Slider
                value={[6 - currentSelection.flexibility]}
                onValueChange={handleFirmnessChange}
                min={1}
                max={5}
                step={1}
                className="w-full"
                aria-label={t("firmness")}
                aria-valuetext={`${6 - currentSelection.flexibility} ${t("of")} 5`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("openToAlternatives")}</span>
                <span>{t("firmOnThis")}</span>
              </div>
            </div>
          )}

          {/* Satisfaction Prediction — shown on last clause when complete, non-solo */}
          {!isSoloMode && isComplete && currentClauseIndex === clauses.length - 1 && prediction?.predicted && (() => {
            const yourScore = Math.round(deal.currentUserRole === "INITIATOR" ? prediction.predictedSatisfactionA : prediction.predictedSatisfactionB);
            const theirScore = Math.round(deal.currentUserRole === "INITIATOR" ? prediction.predictedSatisfactionB : prediction.predictedSatisfactionA);
            const getLabel = (s: number) => s >= 85 ? t("satisfactionCloseToPreference") : s >= 65 ? t("satisfactionFavorable") : s >= 45 ? t("satisfactionBalanced") : s >= 25 ? t("satisfactionAccommodated") : t("satisfactionSignificantConcession");
            const getColor = (s: number) => s >= 85 ? "text-green-600" : s >= 65 ? "text-primary" : s >= 45 ? "text-foreground" : s >= 25 ? "text-amber-600" : "text-red-600";
            return (
              <div className="card-brutal border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="section-label">{t("predictedOutcome")}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t("predictedOutcomeDescription")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-card rounded-lg border border-border">
                    <p className={`text-sm font-semibold ${getColor(yourScore)}`}>{getLabel(yourScore)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("forYou")}</p>
                  </div>
                  <div className="text-center p-3 bg-card rounded-lg border border-border">
                    <p className={`text-sm font-semibold ${getColor(theirScore)}`}>{getLabel(theirScore)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("forThem")}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              onClick={() => {
                if (currentClauseIndex > 0) {
                  setCurrentClauseIndex(currentClauseIndex - 1);
                  setExpandedOption(null);
                }
              }}
              disabled={currentClauseIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {tCommon("previous")}
            </button>

            <div className="flex items-center gap-3">
              {currentClauseIndex === clauses.length - 1 && isAlreadySubmitted ? (
                /* Already submitted — show contextual next step */
                bothSubmitted ? (
                  <button
                    onClick={() => router.push(`/deals/${dealId}/review`)}
                    className="btn-brutal flex items-center gap-2"
                  >
                    {t("reviewCompromises")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : isInitiator && !hasRespondent ? (
                  <button
                    onClick={() => router.push(`/deals/${dealId}`)}
                    className="btn-brutal flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    {t("inviteCounterparty")}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/deals/${dealId}`)}
                    className="btn-brutal flex items-center gap-2"
                  >
                    {t("goToDeal")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )
              ) : currentClauseIndex === clauses.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={!isComplete || submitSelections.isPending}
                  className={`flex items-center gap-2 disabled:opacity-50 font-semibold px-6 py-3 rounded-full transition-all duration-200 ${
                    submitSelections.isPending
                      ? "bg-primary-foreground text-primary border-2 border-primary cursor-wait"
                      : "btn-brutal"
                  }`}
                >
                  {submitSelections.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("submitting")}
                    </>
                  ) : (
                    <>
                      {isSoloMode
                        ? t("soloConfirmGenerate")
                        : t("submitAllSelections")}
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSaveAndContinue}
                  disabled={!currentSelection}
                  className="btn-brutal flex items-center gap-2 disabled:opacity-50"
                >
                  {saveSelections.isPending ? t("saving") : tCommon("continue")}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lawyer Warning Modal */}
      {showLawyerWarning && (
        <LawyerWarningModal
          dealRoomId={dealId}
          open={showLawyerWarning}
          onDismiss={() => refetchDeal()}
        />
      )}
    </div>
  );
}
