"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  STEP_ORDER,
  STEP_META,
  isStepUnlocked,
  type StepKey,
  type StepStatus,
  type StepStatusEntry,
} from "@/lib/journey/steps";
import {
  Rocket,
  ArrowRight,
  Clock,
  Check,
  Shield,
  FileText,
  Loader2,
  Lock,
  ChevronRight,
  Scale,
  CheckSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// docsYouShouldHave is variable-length per step. Keep the count
// here so the component can iterate t() lookups without trying
// to read non-existent keys.
const STEP_DONE_DOC_COUNT: Record<StepKey, number> = {
  foundation: 3,
  "equity-pool": 2,
  hiring: 3,
  raise: 3,
};

export default function JourneyHubPage() {
  const params = useParams();
  const journeyId = params.id as string;
  const t = useTranslations("launch.hub");
  const tSteps = useTranslations("launch.steps");

  const { data: journey, isLoading, refetch } = trpc.journey.get.useQuery({ id: journeyId });
  const [reviewDialogStep, setReviewDialogStep] = useState<StepKey | null>(null);
  const [markDoneDialogStep, setMarkDoneDialogStep] = useState<StepKey | null>(null);

  const resetStep = trpc.journey.resetStepStatus.useMutation({
    onSuccess: () => {
      toast.success(t("stepResetToast"));
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-24" />
        <div className="card-brutal animate-pulse h-48" />
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card-brutal border-yellow-500 text-center py-10">
          <p className="text-yellow-600">{t("journeyNotFound")}</p>
          <Link href="/launch" className="text-primary underline mt-4 inline-block">
            {t("backToLaunch")}
          </Link>
        </div>
      </div>
    );
  }

  const stepStatuses = (journey.stepStatuses ?? {}) as Record<string, StepStatusEntry>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
          <Rocket className="w-3.5 h-3.5" />
          <span>{t("yourLaunch")}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold break-words">{journey.companyName}</h1>
        <p className="text-sm text-muted-foreground">
          {journey.state} {journey.entityType.replace("_", "-")}
          {" · "}
          {journey.founders.length === 1
            ? t("founderCountOne")
            : t("founderCountOther", { count: journey.founders.length })}
          {" · "}
          {journey.dealRooms.length === 1
            ? t("documentCountOne")
            : t("documentCountOther", { count: journey.dealRooms.length })}
        </p>
      </div>

      <div className="space-y-4">
        {STEP_ORDER.map((key) => {
          const meta = STEP_META[key];
          const entry = stepStatuses[key];
          const status = (entry?.status ?? "NOT_STARTED") as StepStatus;
          const unlocked = isStepUnlocked(key, stepStatuses);
          const isFoundation = key === "foundation";
          const isDoneElsewhere = status === "DONE_ELSEWHERE";

          const statusLabel = ({
            NOT_STARTED: t("statusNotStarted"),
            READY_FOR_REVIEW: t("statusReady"),
            AWAITING_REVIEW: t("statusAwaiting"),
            REVIEWED: t("statusReviewed"),
            FILED: t("statusFiled"),
            DONE_ELSEWHERE: t("statusDoneElsewhere"),
          } satisfies Record<StepStatus, string>)[status];

          const StatusIcon = ({
            NOT_STARTED: Clock,
            READY_FOR_REVIEW: FileText,
            AWAITING_REVIEW: Loader2,
            REVIEWED: Shield,
            FILED: Check,
            DONE_ELSEWHERE: CheckSquare,
          } satisfies Record<StepStatus, typeof Clock>)[status];

          const badgeClass = ({
            NOT_STARTED: "bg-muted text-muted-foreground",
            READY_FOR_REVIEW: "bg-blue-500/20 text-blue-500",
            AWAITING_REVIEW: "bg-yellow-500/20 text-yellow-500",
            REVIEWED: "bg-primary/20 text-primary",
            FILED: "bg-green-500/20 text-green-600",
            DONE_ELSEWHERE: "bg-slate-500/20 text-slate-400",
          } satisfies Record<StepStatus, string>)[status];

          const stepTitle = tSteps(`${key}.title`);
          const stepDescription = tSteps(`${key}.description`);
          const fallbackSkillsLabel =
            meta.fallbackSkills && meta.fallbackSkills.length > 0
              ? tSteps(`${key}.fallbackSkills`)
              : null;

          return (
            <div
              key={key}
              className={`card-brutal ${unlocked ? "" : "opacity-60"}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-semibold">{stepTitle}</h2>
                    <Badge className={badgeClass}>
                      <StatusIcon className={`w-3 h-3 mr-1 ${status === "AWAITING_REVIEW" ? "animate-spin" : ""}`} />
                      {statusLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{stepDescription}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {t("estimatedMinutes", { n: meta.estimatedMinutes })}
                  </p>
                  {unlocked && status === "NOT_STARTED" && !isFoundation && fallbackSkillsLabel && (
                    <p className="text-xs text-muted-foreground pt-1">
                      <span className="font-mono uppercase tracking-wider text-[10px]">{t("availableNow")}</span>{" "}
                      {fallbackSkillsLabel}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-shrink-0 sm:items-end">
                  {!unlocked ? (
                    <div
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                      title={t("unlocksAfter", { step: tSteps(`${meta.unlockedBy!}.title`) })}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t("locked")}</span>
                    </div>
                  ) : isDoneElsewhere ? (
                    <button
                      onClick={() =>
                        resetStep.mutate({ journeyId: journey.id, stepKey: key })
                      }
                      disabled={resetStep.isPending}
                      className="inline-flex items-center min-h-[44px] py-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40"
                    >
                      {t("actuallyINeed")}
                    </button>
                  ) : isFoundation ? (
                    <Link
                      href={`/launch/${journey.id}/step/${key}`}
                      className="btn-brutal inline-flex items-center gap-2"
                    >
                      {status === "NOT_STARTED" ? t("start") : t("open")}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : meta.fallbackSearch ? (
                    <Link
                      href={`/deals/new?q=${encodeURIComponent(meta.fallbackSearch)}`}
                      className="btn-brutal-outline inline-flex items-center gap-2"
                      title={t("createIndividuallyHint")}
                    >
                      {t("createIndividually")}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                      title={t("soonHint")}
                    >
                      <Clock className="w-3.5 h-3.5" /> {t("soon")}
                    </span>
                  )}
                  {unlocked && status === "NOT_STARTED" && (
                    <button
                      onClick={() => setMarkDoneDialogStep(key)}
                      className="inline-flex items-center min-h-[44px] py-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      {t("iHaveThis")}
                    </button>
                  )}
                </div>
              </div>

              {entry?.dealIds && entry.dealIds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div className="space-y-1">
                    {journey.dealRooms
                      .filter((d) => d.journeyStepKey === key)
                      .map((d) => (
                        <Link
                          key={d.id}
                          href={`/deals/${d.id}`}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-1 group"
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate min-w-0">{d.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                  </div>
                  {status === "READY_FOR_REVIEW" && (
                    <button
                      onClick={() => setReviewDialogStep(key)}
                      className="btn-brutal-outline inline-flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                      <Scale className="w-4 h-4" /> {t("requestLawyerReview")}
                    </button>
                  )}
                  {status === "AWAITING_REVIEW" && (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t("waitingForLawyer", { count: entry.dealIds.length })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {reviewDialogStep && (
        <RequestReviewDialog
          journeyId={journey.id}
          stepKey={reviewDialogStep}
          dealIdsInStep={(
            journey.dealRooms
              .filter((d) => d.journeyStepKey === reviewDialogStep)
              .map((d) => d.id) ?? []
          )}
          onClose={() => setReviewDialogStep(null)}
          onSuccess={() => {
            setReviewDialogStep(null);
            refetch();
          }}
        />
      )}

      {markDoneDialogStep && (
        <MarkStepDoneDialog
          journeyId={journey.id}
          stepKey={markDoneDialogStep}
          onClose={() => setMarkDoneDialogStep(null)}
          onSuccess={() => {
            setMarkDoneDialogStep(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function MarkStepDoneDialog({
  journeyId,
  stepKey,
  onClose,
  onSuccess,
}: {
  journeyId: string;
  stepKey: StepKey;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const tDoneDialog = useTranslations("launch.hub.doneDialog");
  const tStepDone = useTranslations("launch.stepDone");
  const [note, setNote] = useState("");

  const docCount = STEP_DONE_DOC_COUNT[stepKey];
  const docs = Array.from({ length: docCount }, (_, i) =>
    tStepDone(`${stepKey}.doc${i + 1}`),
  );

  const markDone = trpc.journey.markStepDoneElsewhere.useMutation({
    onSuccess: () => {
      toast.success(tDoneDialog("successToast"));
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border w-full max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tStepDone(`${stepKey}.title`)}</DialogTitle>
          <DialogDescription>{tStepDone(`${stepKey}.explainer`)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
              {tDoneDialog("youShouldHave")}
            </p>
            <ul className="space-y-1.5 text-sm">
              {docs.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="step-done-note" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {tDoneDialog("noteLabel")}
            </label>
            <textarea
              id="step-done-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tDoneDialog("notePlaceholder")}
              rows={2}
              maxLength={500}
              className="input-brutal w-full resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {tDoneDialog("cancel")}
          </button>
          <button
            onClick={() =>
              markDone.mutate({
                journeyId,
                stepKey,
                note: note.trim() || undefined,
              })
            }
            disabled={markDone.isPending}
            className="btn-brutal inline-flex items-center gap-2 disabled:opacity-40"
          >
            {markDone.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {tDoneDialog("saving")}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {tStepDone(`${stepKey}.confirmCta`)}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestReviewDialog({
  journeyId,
  stepKey,
  dealIdsInStep,
  onClose,
  onSuccess,
}: {
  journeyId: string;
  stepKey: StepKey;
  dealIdsInStep: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const tReview = useTranslations("launch.hub.reviewDialog");
  const tSteps = useTranslations("launch.steps");
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const firstDealId = dealIdsInStep[0];
  const { data: attorneys, isLoading } = trpc.attorneyReview.listAvailableAttorneys.useQuery(
    firstDealId ? { dealRoomId: firstDealId } : { dealRoomId: "" },
    { enabled: !!firstDealId },
  );

  const request = trpc.journey.requestStepReview.useMutation({
    onSuccess: (res) => {
      const assigned = res.results.filter((r) => r.status === "assigned").length;
      toast.success(
        assigned === 1
          ? tReview("successOne")
          : tReview("successOther", { count: assigned }),
      );
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const stepLabel = tSteps(`${stepKey}.title`);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border w-full max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tReview("title")}</DialogTitle>
          <DialogDescription>
            {dealIdsInStep.length === 1
              ? tReview("descriptionOne", { step: stepLabel })
              : tReview("description", { count: dealIdsInStep.length, step: stepLabel })}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : !attorneys?.length ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {tReview("noAttorneys")}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {attorneys.map((a) => (
              <button
                key={a.id}
                onClick={() => !a.unavailable && setSupervisorId(a.id)}
                disabled={a.unavailable}
                className={`w-full text-left p-3 border transition-colors ${
                  supervisorId === a.id
                    ? "border-primary bg-primary/5"
                    : a.unavailable
                      ? "border-border opacity-50 cursor-not-allowed"
                      : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.email}
                      {a.barNumber ? ` · ${tReview("barNumber", { n: a.barNumber })}` : ""}
                    </p>
                    {a.unavailable && (
                      <p className="text-xs text-orange-500 mt-1">
                        {a.unavailable}
                      </p>
                    )}
                  </div>
                  {supervisorId === a.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {tReview("cancel")}
          </button>
          <button
            disabled={!supervisorId || request.isPending}
            onClick={() =>
              supervisorId &&
              request.mutate({ journeyId, stepKey, supervisorId })
            }
            className="btn-brutal inline-flex items-center gap-2 disabled:opacity-40"
          >
            {request.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {tReview("requesting")}
              </>
            ) : (
              <>{tReview("request")}</>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
