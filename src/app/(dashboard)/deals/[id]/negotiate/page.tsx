"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Star,
  Sliders,
  Copy,
  List,
  ChevronsRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle } from "lucide-react";

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

const governingLawLabels: Record<GoverningLaw, string> = {
  CALIFORNIA: "California",
  ENGLAND_WALES: "England & Wales",
  SPAIN: "Spain",
};

interface Selection {
  dealRoomClauseId: string;
  optionId: string;
  priority: number;
  flexibility: number;
}

export default function NegotiatePage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;
  const t = useTranslations("negotiate");
  const tCommon = useTranslations("common");

  const [currentClauseIndex, setCurrentClauseIndex] = useState(0);
  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [showProsConsFor, setShowProsConsFor] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: deal, isLoading, error } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: existingSelections } = trpc.selections.getMySelections.useQuery({ dealRoomId: dealId });

  // Check if the user is a respondent and if counterparty selections are available
  const isRespondent = deal?.currentUserRole === "RESPONDENT";
  const initiatorParty = deal?.parties.find((p) => p.role === "INITIATOR");
  const hasInitiatorSubmitted = initiatorParty?.status === "SUBMITTED" ||
                                initiatorParty?.status === "REVIEWING" ||
                                initiatorParty?.status === "ACCEPTED";
  const canPrePopulate = isRespondent && hasInitiatorSubmitted;

  const saveSelections = trpc.selections.bulkSave.useMutation();
  const submitSelections = trpc.deal.submitSelections.useMutation({
    onSuccess: (result) => {
      if (result.bothSubmitted) {
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
      setSelections(map);
    }
  }, [existingSelections]);

  // Scroll to top whenever the active clause changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentClauseIndex]);

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
          <span>Failed to load deal: {error?.message || "Not found"}</span>
        </div>
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

  const handlePriorityChange = (value: number[]) => {
    const existing = selections.get(currentClause.id);
    if (existing) {
      setSelections(new Map(selections.set(currentClause.id, {
        ...existing,
        priority: value[0],
      })));
    }
  };

  const handleFlexibilityChange = (value: number[]) => {
    const existing = selections.get(currentClause.id);
    if (existing) {
      setSelections(new Map(selections.set(currentClause.id, {
        ...existing,
        flexibility: value[0],
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
      } catch (e) {
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
      } catch (e) {
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-heading">{deal.name}</h1>
            <p className="text-sm text-muted-foreground">
              {deal.contractTemplate.displayName} • Clause <span className="metric text-foreground">{currentClauseIndex + 1}</span> of <span className="metric">{clauses.length}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="metric"><span className="text-primary">{selections.size}</span><span className="text-muted-foreground">/{clauses.length}</span></p>
          </div>
          <Progress value={progress} className="w-32 h-1.5" />
        </div>
      </div>

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
                  {isPrePopulating ? "Loading..." : "Pre-populate with my counterparty's selections"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Save time by starting with the other party&apos;s choices. You can still adjust any selection before submitting.
                </p>
              </div>
            </button>
          </label>
        </div>
      )}

      {/* Skip to Submit banner — shown when all clauses selected but not on last clause */}
      {isComplete && currentClauseIndex < clauses.length - 1 && (
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
              className="p-6 pt-8 overflow-y-auto h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <p className="section-label text-primary">Clauses</p>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground"
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
                {currentClause.clauseTemplate.isRequired ? "Required" : "Optional"}
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
                Select Your Preferred Option
              </p>
              <Badge variant="outline" className="text-xs">
                {governingLawLabels[governingLaw]} Law
              </Badge>
            </div>

            {/* Warning if current selection became unavailable */}
            {currentSelectionUnavailable && (
              <div className="p-3 border border-warning/50 bg-warning/10 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-sm text-warning">
                  Your previous selection is not available under {governingLawLabels[governingLaw]} law. Please select a different option.
                </p>
              </div>
            )}

            {availableOptions.map((option) => {
              const isSelected = currentSelection?.optionId === option.id;
              const isExpanded = expandedOption === option.id;
              const jurisdictionRules = getJurisdictionRules(option);
              const hasWarning = jurisdictionRules?.warning;
              const hasNote = jurisdictionRules?.note;

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
                      {/* Radio circle */}
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                        ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}
                      `}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-heading text-base">{option.label}</p>
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
                      className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Jurisdiction Warning Banner */}
                  {hasWarning && (
                    <div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-200">{jurisdictionRules.warning}</p>
                    </div>
                  )}

                  {/* Jurisdiction Note Banner */}
                  {hasNote && !hasWarning && (
                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-200">{jurisdictionRules.note}</p>
                    </div>
                  )}

                  {/* Expandable detail with CSS Grid animation */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-4 mt-4 border-t border-border space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* Jurisdiction Note (when expanded, if there's also a warning) */}
                        {hasNote && hasWarning && (
                          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-200">{jurisdictionRules.note}</p>
                          </div>
                        )}

                        {/* Pros/Cons */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Pros for You</p>
                            <ul className="space-y-1">
                              {(deal.currentUserRole === "INITIATOR" ? option.prosPartyA : option.prosPartyB).map((pro, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="text-primary">+</span>
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-warning uppercase tracking-wider mb-2">Cons for You</p>
                            <ul className="space-y-1">
                              {(deal.currentUserRole === "INITIATOR" ? option.consPartyA : option.consPartyB).map((con, i) => (
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
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Legal Text</p>
                          <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 border border-border rounded-xl">
                            {option.legalText}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority & Flexibility */}
          {currentSelection && (
            <div className="card-brutal space-y-6">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-muted-foreground" />
                <span className="section-label">
                  Importance Settings
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Priority</p>
                      <p className="text-xs text-muted-foreground">How important is this clause to you?</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`w-4 h-4 ${n <= currentSelection.priority ? "text-primary fill-primary" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Slider
                    value={[currentSelection.priority]}
                    onValueChange={handlePriorityChange}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low priority</span>
                    <span>High priority</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Flexibility</p>
                      <p className="text-xs text-muted-foreground">How willing are you to compromise?</p>
                    </div>
                    <span className="text-sm font-medium">{currentSelection.flexibility}/5</span>
                  </div>
                  <Slider
                    value={[currentSelection.flexibility]}
                    onValueChange={handleFlexibilityChange}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Must have my way</span>
                    <span>Very flexible</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              Previous
            </button>

            <div className="flex items-center gap-3">
              {currentClauseIndex === clauses.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={!isComplete || submitSelections.isPending}
                  className="btn-brutal flex items-center gap-2 disabled:opacity-50"
                >
                  {submitSelections.isPending ? "Submitting..." : "Submit All Selections"}
                  <Check className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSaveAndContinue}
                  disabled={!currentSelection}
                  className="btn-brutal flex items-center gap-2 disabled:opacity-50"
                >
                  {saveSelections.isPending ? "Saving..." : "Continue"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
