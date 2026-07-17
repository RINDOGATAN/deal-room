"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AiDraftPanel — the one UX for every AI assist in the suite.
 *
 * Ported from dpocentral-todo/src/components/ai/AiDraftPanel.tsx and adapted
 * for Dealroom: the posture is install-level (getStatus takes no input), the
 * feature flag is `features.aiAssist`, and a `persisted` mode is added for
 * this app's grounded features (compromise explanation, risk digest), whose
 * mutations persist the labeled text server-side — the parent re-renders the
 * stored text after onGenerated, so the Insert/Discard review card is skipped.
 *
 * Status-aware: posture off shows a quiet hint (no calls are ever made);
 * posture on without an engine shows the admin hint; otherwise a "Draft
 * with AI" button. In insert mode a generated draft is shown read-only with
 * the provenance line ("AI-generated with {model} — review before use") and
 * two actions: Insert (hands the text to the parent's EDITABLE field and
 * stamps acceptedAt) or Discard. In insert mode the panel never writes AI
 * output to the DB.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { features } from "@/config/features";

export interface AiDraft {
  content: string;
  model: string;
  generationId: string;
}

const KNOWN_ERROR_CODES = [
  "ai_off",
  "ai_not_configured",
  "ai_rate_limited",
  "ai_failed",
  "ai_digest_locked",
  "ai_digest_no_request",
] as const;
type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

function knownErrorCode(message: string | undefined): KnownErrorCode | null {
  return KNOWN_ERROR_CODES.includes(message as KnownErrorCode)
    ? (message as KnownErrorCode)
    : null;
}

interface AiDraftPanelProps {
  /** Run the feature's generate mutation (server-side prompts only). */
  onGenerate: () => Promise<AiDraft | void>;
  /** Insert mode: put the draft into the parent's editable field. */
  onInsert?: (content: string) => void;
  /**
   * Persisted mode: the mutation already stored the labeled text server-side
   * (Dealroom's grounded features); onGenerated lets the parent refetch.
   */
  persisted?: boolean;
  onGenerated?: () => void;
  /** Override the generate-button label (e.g. "Explain with AI"). */
  generateLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function AiDraftPanel({
  onGenerate,
  onInsert,
  persisted,
  onGenerated,
  generateLabel,
  disabled,
  className,
}: AiDraftPanelProps) {
  const t = useTranslations("ai");
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  // Monotonic run id: Cancel bumps it so a late-arriving result is ignored.
  const runIdRef = useRef(0);

  const { data: status } = trpc.ai.getStatus.useQuery(undefined, {
    enabled: features.aiAssist,
    staleTime: 60_000,
  });

  const markAccepted = trpc.ai.markAccepted.useMutation();

  if (!features.aiAssist || !status) return null;

  // Posture off (or no row): the assist is invisible-but-explained. No calls.
  if (status.posture === "off") {
    return (
      <div className={`flex items-start gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{t("panel.offHint")}</span>
      </div>
    );
  }

  // Posture on but no engine configured: admin hint, no call.
  if (!status.configured) {
    return (
      <div className={`flex items-start gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{t("panel.notConfiguredHint")}</span>
      </div>
    );
  }

  const handleGenerate = async () => {
    const runId = ++runIdRef.current;
    setIsGenerating(true);
    try {
      const result = await onGenerate();
      if (runIdRef.current !== runId) return; // cancelled while waiting
      if (persisted) {
        onGenerated?.();
      } else if (result) {
        setDraft(result);
      }
    } catch (error: unknown) {
      if (runIdRef.current !== runId) return; // cancelled while waiting
      const message = error instanceof Error ? error.message : undefined;
      const code = knownErrorCode(message);
      toast.error(code ? t(`errors.${code}`) : message || t("errors.ai_failed"));
    } finally {
      if (runIdRef.current === runId) setIsGenerating(false);
    }
  };

  // Client-side cancel only: it stops the wait (and ignores the eventual
  // result), but the server request may still complete — and still counts
  // against the hourly generation limit.
  const handleCancel = () => {
    runIdRef.current++;
    setIsGenerating(false);
  };

  const handleInsert = () => {
    if (!draft || !onInsert) return;
    onInsert(draft.content);
    // Audit: stamp acceptedAt (metadata only) — best-effort
    markAccepted.mutate({ generationId: draft.generationId });
    toast.success(t("panel.inserted"));
    setDraft(null);
  };

  if (!draft) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={disabled || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {isGenerating ? t("panel.generating") : generateLabel ?? t("panel.draftWithAi")}
          </Button>
          {isGenerating && (
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1.5" />
              {t("panel.cancel")}
            </Button>
          )}
        </div>
        {isGenerating && (
          <p className="mt-1.5 text-xs text-muted-foreground">{t("panel.waitHint")}</p>
        )}
      </div>
    );
  }

  return (
    <Card className={`border-primary/30 ${className ?? ""}`}>
      <CardContent className="pt-4 space-y-3">
        <div className="text-sm whitespace-pre-wrap max-h-72 overflow-y-auto rounded-md bg-muted/50 p-3">
          {draft.content}
        </div>
        <p className="text-xs text-muted-foreground italic">
          {t("panel.provenance", { model: draft.model })}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)}>
            <X className="w-4 h-4 mr-1.5" />
            {t("panel.discard")}
          </Button>
          <Button type="button" size="sm" onClick={handleInsert}>
            <Check className="w-4 h-4 mr-1.5" />
            {t("panel.insert")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
