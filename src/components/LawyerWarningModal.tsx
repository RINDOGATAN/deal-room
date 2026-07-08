"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { trpc } from "@/lib/trpc";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Shield, AlertTriangle } from "lucide-react";

interface LawyerWarningModalProps {
  dealRoomId: string;
  open: boolean;
  onDismiss: () => void;
}

export function LawyerWarningModal({
  dealRoomId,
  open,
  onDismiss,
}: LawyerWarningModalProps) {
  const t = useTranslations("lawyerWarning");

  const dismissMutation = trpc.deal.dismissLawyerWarning.useMutation({
    onSuccess: () => {
      onDismiss();
    },
  });

  const handleDismiss = () => {
    dismissMutation.mutate({ dealRoomId });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="bg-card border-border w-full max-w-[calc(100%-2rem)] sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-warning/20 flex items-center justify-center rounded-2xl flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <DialogTitle className="font-heading text-xl">
              {t("title")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Risk warning */}
          <p className="text-sm text-muted-foreground">
            {t("riskWarning")}
          </p>

          {/* Timeline of stages */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("lawyerStages")}
            </p>

            {/* Stage 0 — Skipped */}
            <div className="flex items-start gap-3 pl-1">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-muted-foreground">0</span>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground line-through">
                  {t("stage0Title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("stage0Skipped")}
                </p>
              </div>
            </div>

            {/* Stage A */}
            <div className="flex items-start gap-3 pl-1">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-primary">A</span>
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t("stageATitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("stageADescription")}
                </p>
              </div>
            </div>

            {/* Stage B */}
            <div className="flex items-start gap-3 pl-1">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-purple-500">B</span>
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t("stageBTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("stageBDescription")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          disabled={dismissMutation.isPending}
          className="btn-brutal w-full flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          {dismissMutation.isPending ? t("dismissing") : t("dismiss")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
