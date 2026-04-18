"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { STEP_META, type StepKey } from "@/lib/journey/steps";
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
 */
const FOUNDATION_QUESTIONS = [
  {
    key: "vesting",
    question: "If a founder leaves in the first year, should they keep the shares they haven't earned?",
    advancedDisclosure:
      "Translates to vesting schedule and cliff in the Founders' Agreement. 'Standard' = four-year vesting with a one-year cliff, the default expectation of most VCs.",
    options: [
      {
        id: "standard",
        label: "No — vest over 4 years with a 1-year cliff",
        description: "Founders earn their shares over four years; leaving in year one means they walk away with none. Standard for venture-backed startups.",
        recommended: true,
      },
      {
        id: "founder-friendly",
        label: "Partly — 2-year vesting with no cliff",
        description: "Faster vesting, no all-or-nothing first year. Some early-stage teams prefer this when co-founders have an established relationship.",
      },
      {
        id: "none",
        label: "No vesting — they keep whatever they're issued",
        description: "Riskiest option. If a founder leaves on day two, the cap table stays with them. Hard to raise a priced round later.",
      },
    ],
  },
  {
    key: "ip-scope",
    question: "Should founders assign every invention — past and future — that relates to the company?",
    advancedDisclosure:
      "Translates to the scope clause in each founder's IP Assignment. 'Broad' captures prior inventions relating to the business; 'narrow' only captures inventions made on company time.",
    options: [
      {
        id: "broad",
        label: "Yes — assign everything relevant to the company, past and future",
        description: "Standard for investor-friendly startups. Protects the company's IP foundation.",
        recommended: true,
      },
      {
        id: "narrow",
        label: "Only inventions made during company work",
        description: "Less common; may leave ambiguity over inventions created before formation.",
      },
    ],
  },
] as const;

export default function StepWizardPage() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;
  const stepKey = params.stepKey as StepKey;
  const meta = STEP_META[stepKey];

  const { data: journey, isLoading } = trpc.journey.get.useQuery({ id: journeyId });
  const generate = trpc.journey.generateStep.useMutation({
    onSuccess: (res) => {
      toast.success(`Generated ${res.deals.length} document${res.deals.length === 1 ? "" : "s"}.`);
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
          <ArrowLeft className="w-4 h-4" /> Back to your launch
        </Link>
        <div className="card-brutal text-center py-10 space-y-3">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-semibold">{meta?.title ?? "Coming soon"}</h1>
          <p className="text-sm text-muted-foreground">
            This step will be available in the next release. Today's release covers Formation only.
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

  const questions = FOUNDATION_QUESTIONS;
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
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">
            {atReview ? "Review and generate" : `Question ${currentIdx + 1} of ${questions.length}`}
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
          <h2 className="text-2xl font-bold leading-tight">{currentQ.question}</h2>

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
                        <p className="font-semibold">{opt.label}</p>
                        {"recommended" in opt && opt.recommended && (
                          <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{opt.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>

          {currentQ.advancedDisclosure && (
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
                What does this mean legally?
              </button>
              {showAdvanced[currentQ.key] && (
                <p className="mt-2 text-xs text-muted-foreground p-3 bg-muted/30 border border-border rounded">
                  {currentQ.advancedDisclosure}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {atReview && (
        <div className="space-y-6">
          <div className="card-brutal space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="w-5 h-5 text-primary" /> Ready to generate
            </h2>
            <p className="text-sm text-muted-foreground">
              We'll create {documentCount} document{documentCount === 1 ? "" : "s"} for{" "}
              <span className="font-medium text-foreground">{journey.companyName}</span>. Each one will be pre-filled from your company profile and your answers to the questions above.
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Certificate of Incorporation
              </div>
              {journey.founders.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Founders' Agreement &mdash; {f.name}
                </div>
              ))}
              {journey.founders.map((f) => (
                <div key={`${f.id}-ip`} className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  IP Assignment &mdash; {f.name}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <Label htmlFor="registered-agent">Delaware registered agent (optional)</Label>
              <Input
                id="registered-agent"
                value={registeredAgent}
                onChange={(e) => setRegisteredAgent(e.target.value)}
                placeholder="e.g., Harvard Business Services, 16192 Coastal Hwy, Lewes, DE 19958"
                className="input-brutal"
              />
              <p className="text-xs text-muted-foreground">
                You can also fill this in later when you're ready to file with Delaware.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center gap-3">
            <button
              onClick={() => setCurrentIdx(questions.length - 1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="btn-brutal inline-flex items-center gap-2 disabled:opacity-40"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Generate {documentCount} document{documentCount === 1 ? "" : "s"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
