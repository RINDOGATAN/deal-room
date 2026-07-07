"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { type StepKey } from "@/lib/journey/steps";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Plain-language questions for the Foundation step.
 * Each question's answer id gets passed to journey.generateStep. The server
 * currently doesn't branch on these (Foundation always produces the same
 * doc set), but we persist the answers so future passes can tailor clauses.
 *
 * The label/description/disclosure copy lives in messages files
 * (launch.step.questions.*); the structural data (which options exist,
 * which is recommended) stays here so the rendering loop can stay typed.
 */
const FOUNDATION_QUESTION_KEYS = [
  {
    key: "vesting",
    namespace: "vesting",
    options: [
      { id: "standard", label: "standardLabel", description: "standardDescription", recommended: true },
      { id: "founder-friendly", label: "founderFriendlyLabel", description: "founderFriendlyDescription" },
      { id: "none", label: "noneLabel", description: "noneDescription" },
    ],
  },
  {
    key: "ip-scope",
    namespace: "ipScope",
    options: [
      { id: "broad", label: "broadLabel", description: "broadDescription", recommended: true },
      { id: "narrow", label: "narrowLabel", description: "narrowDescription" },
    ],
  },
] as const;

export default function StepWizardPage() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;
  const stepKey = params.stepKey as StepKey;
  const t = useTranslations("launch.step");
  const tQ = useTranslations("launch.step.questions");
  const tSteps = useTranslations("launch.steps");

  const { data: journey, isLoading } = trpc.journey.get.useQuery({ id: journeyId });
  const generate = trpc.journey.generateStep.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.deals.length === 1
          ? t("generatedToastOne")
          : t("generatedToastOther", { count: res.deals.length }),
      );
      router.push(`/launch/${journeyId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [registeredAgent, setRegisteredAgent] = useState("");
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});

  if (stepKey !== "foundation") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href={`/launch/${journeyId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t("backToLaunch")}
        </Link>
        <div className="card-brutal text-center py-10 space-y-3">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-semibold">{tSteps(`${stepKey}.title`)}</h1>
          <p className="text-sm text-muted-foreground">
            {t("comingSoonBody")}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !journey) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card-brutal animate-pulse h-48" />
      </div>
    );
  }

  const questions = FOUNDATION_QUESTION_KEYS;
  const atReview = currentIdx >= questions.length;
  const currentQ = atReview ? null : questions[currentIdx];
  const progressPct = Math.round((Math.min(currentIdx, questions.length) / (questions.length + 1)) * 100);

  const documentCount = 1 + journey.founders.length * 2;

  function handlePick(questionKey: string, optionId: string) {
    setAnswers((a) => ({ ...a, [questionKey]: optionId }));
    setCurrentIdx((i) => i + 1);
  }

  function handleBack() {
    if (currentIdx === 0) {
      router.push(`/launch/${journeyId}`);
    } else {
      setCurrentIdx((i) => i - 1);
    }
  }

  function handleGenerate() {
    generate.mutate({
      journeyId,
      stepKey,
      answers: {
        ...answers,
        ...(registeredAgent ? { "registered-agent": registeredAgent.trim() } : {}),
      },
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("backAria")}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{tSteps(`${stepKey}.title`)}</h1>
          <p className="text-sm text-muted-foreground">
            {atReview
              ? t("reviewAndGenerate")
              : t("questionOf", { n: currentIdx + 1, total: questions.length })}
          </p>
        </div>
      </div>

      <div className="h-1 bg-muted rounded-full overflow-hidden" aria-hidden>
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${atReview ? 100 : progressPct}%` }}
        />
      </div>

      {!atReview && currentQ && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold leading-tight">{tQ(`${currentQ.namespace}.question`)}</h2>

          <div className="space-y-3">
            {currentQ.options.map((opt) => {
              const selected = answers[currentQ.key] === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handlePick(currentQ.key, opt.id)}
                  className={`w-full text-left p-4 border transition-all ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{tQ(`${currentQ.namespace}.${opt.label}`)}</p>
                        {"recommended" in opt && opt.recommended && (
                          <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {t("recommended")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{tQ(`${currentQ.namespace}.${opt.description}`)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <button
              onClick={() => setShowAdvanced((s) => ({ ...s, [currentQ.key]: !s[currentQ.key] }))}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              aria-expanded={showAdvanced[currentQ.key] ?? false}
            >
              {showAdvanced[currentQ.key] ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {t("whatDoesThisMean")}
            </button>
            {showAdvanced[currentQ.key] && (
              <p className="mt-2 text-xs text-muted-foreground p-3 bg-muted/30 border border-border rounded">
                {tQ(`${currentQ.namespace}.advancedDisclosure`)}
              </p>
            )}
          </div>
        </div>
      )}

      {atReview && (
        <div className="space-y-6">
          <div className="card-brutal space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="w-5 h-5 text-primary" /> {t("readyToGenerate")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {documentCount === 1
                ? t.rich("willCreateOne", {
                    company: () => (
                      <span className="font-medium text-foreground">{journey.companyName}</span>
                    ),
                  })
                : t.rich("willCreateOther", {
                    count: documentCount,
                    company: () => (
                      <span className="font-medium text-foreground">{journey.companyName}</span>
                    ),
                  })}
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                {t("certificateOfIncorporation")}
              </div>
              {journey.founders.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {t("foundersAgreement")} &mdash; {f.name}
                </div>
              ))}
              {journey.founders.map((f) => (
                <div key={`${f.id}-ip`} className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {t("ipAssignment")} &mdash; {f.name}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <Label htmlFor="registered-agent">{t("registeredAgentLabel")}</Label>
              <Input
                id="registered-agent"
                value={registeredAgent}
                onChange={(e) => setRegisteredAgent(e.target.value)}
                placeholder={t("registeredAgentPlaceholder")}
                className="input-brutal"
              />
              <p className="text-xs text-muted-foreground">
                {t("registeredAgentHint")}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center gap-3">
            <button
              onClick={() => setCurrentIdx(questions.length - 1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("back")}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="btn-brutal inline-flex items-center gap-2 disabled:opacity-40"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("generating")}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />{" "}
                  {documentCount === 1
                    ? t("generateOne")
                    : t("generateOther", { count: documentCount })}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
