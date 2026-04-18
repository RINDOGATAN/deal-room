"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { STEP_ORDER, STEP_META, type StepKey } from "@/lib/journey/steps";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type StepStatusEntry = {
  status?: "NOT_STARTED" | "READY_FOR_REVIEW" | "AWAITING_REVIEW" | "REVIEWED" | "FILED";
  completedAt?: string;
  filedAt?: string;
  supervisorId?: string;
  dealIds?: string[];
};

export default function JourneyHubPage() {
  const params = useParams();
  const journeyId = params.id as string;

  const { data: journey, isLoading, refetch } = trpc.journey.get.useQuery({ id: journeyId });
  const [reviewDialogStep, setReviewDialogStep] = useState<StepKey | null>(null);

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
          <p className="text-yellow-600">Journey not found.</p>
          <Link href="/launch" className="text-primary underline mt-4 inline-block">
            Back to Launch
          </Link>
        </div>
      </div>
    );
  }

  const stepStatuses = (journey.stepStatuses ?? {}) as Record<string, StepStatusEntry>;

  const isStepUnlocked = (key: StepKey): boolean => {
    const meta = STEP_META[key];
    if (!meta.unlockedBy) return true;
    const dep = stepStatuses[meta.unlockedBy];
    return !!dep && dep.status !== "NOT_STARTED";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
          <Rocket className="w-3.5 h-3.5" />
          <span>Your launch</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">{journey.companyName}</h1>
        <p className="text-sm text-muted-foreground">
          {journey.state} {journey.entityType.replace("_", "-")}
          {" \u00b7 "}
          {journey.founders.length} founder{journey.founders.length === 1 ? "" : "s"}
          {" \u00b7 "}
          {journey.dealRooms.length} document{journey.dealRooms.length === 1 ? "" : "s"} generated
        </p>
      </div>

      <div className="space-y-4">
        {STEP_ORDER.map((key) => {
          const meta = STEP_META[key];
          const entry = stepStatuses[key];
          const status = entry?.status ?? "NOT_STARTED";
          const unlocked = isStepUnlocked(key);
          const isFoundation = key === "foundation";

          const statusLabel = {
            NOT_STARTED: "Not started",
            READY_FOR_REVIEW: "Ready",
            AWAITING_REVIEW: "Awaiting lawyer",
            REVIEWED: "Approved",
            FILED: "Filed",
          }[status];

          const StatusIcon = {
            NOT_STARTED: Clock,
            READY_FOR_REVIEW: FileText,
            AWAITING_REVIEW: Loader2,
            REVIEWED: Shield,
            FILED: Check,
          }[status];

          const badgeClass = {
            NOT_STARTED: "bg-muted text-muted-foreground",
            READY_FOR_REVIEW: "bg-blue-500/20 text-blue-500",
            AWAITING_REVIEW: "bg-yellow-500/20 text-yellow-500",
            REVIEWED: "bg-primary/20 text-primary",
            FILED: "bg-green-500/20 text-green-600",
          }[status];

          return (
            <div
              key={key}
              className={`card-brutal ${unlocked ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-semibold">{meta.title}</h2>
                    <Badge className={badgeClass}>
                      <StatusIcon className={`w-3 h-3 mr-1 ${status === "AWAITING_REVIEW" ? "animate-spin" : ""}`} />
                      {statusLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    ~{meta.estimatedMinutes} min
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {!unlocked ? (
                    <div
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                      title={`Unlocks after ${STEP_META[meta.unlockedBy!].title}`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Locked</span>
                    </div>
                  ) : isFoundation ? (
                    <Link
                      href={`/launch/${journey.id}/step/${key}`}
                      className="btn-brutal inline-flex items-center gap-2"
                    >
                      {status === "NOT_STARTED" ? "Start" : "Open"}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                      title="Coming in the next release"
                    >
                      <Clock className="w-3.5 h-3.5" /> Soon
                    </span>
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
                      <Scale className="w-4 h-4" /> Request lawyer review
                    </button>
                  )}
                  {status === "AWAITING_REVIEW" && (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Waiting for lawyer to approve all {entry.dealIds.length} documents
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
    </div>
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
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const firstDealId = dealIdsInStep[0];
  const { data: attorneys, isLoading } = trpc.attorneyReview.listAvailableAttorneys.useQuery(
    firstDealId ? { dealRoomId: firstDealId } : { dealRoomId: "" },
    { enabled: !!firstDealId },
  );

  const request = trpc.journey.requestStepReview.useMutation({
    onSuccess: (res) => {
      const assigned = res.results.filter((r) => r.status === "assigned").length;
      toast.success(`Review requested on ${assigned} document${assigned === 1 ? "" : "s"}.`);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border w-full max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request lawyer review</DialogTitle>
          <DialogDescription>
            Pick a lawyer. They'll see all {dealIdsInStep.length} document
            {dealIdsInStep.length === 1 ? "" : "s"} in the {STEP_META[stepKey].title.toLowerCase()} step and can approve each one.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : !attorneys?.length ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              No supervising attorneys are currently available for your jurisdiction.
            </p>
            <Link href="/lawyers" className="text-sm text-primary underline">
              Browse the Experts Directory
            </Link>
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
                      {a.barNumber ? ` · Bar #${a.barNumber}` : ""}
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
            Cancel
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
                <Loader2 className="w-4 h-4 animate-spin" /> Requesting...
              </>
            ) : (
              <>Request review</>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
