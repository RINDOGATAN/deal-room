"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Briefcase, Scale, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface OnboardingModalProps {
  open: boolean;
  dismissible?: boolean;
  onComplete?: () => void;
}

export function OnboardingModal({ open, dismissible, onComplete }: OnboardingModalProps) {
  const t = useTranslations("onboarding");
  const { update: updateSession } = useSession();
  const [selected, setSelected] = useState<"BUSINESS_OWNER" | "LAWYER" | null>(null);

  const utils = trpc.useUtils();
  const setRole = trpc.lawyer.setRole.useMutation({
    onSuccess: async () => {
      await updateSession();
      utils.lawyer.getProfile.invalidate();
      onComplete?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleContinue = () => {
    if (!selected) return;
    setRole.mutate({ role: selected });
  };

  const roleLabel = selected === "LAWYER" ? t("roleLawyer") : t("roleBusiness");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && dismissible) onComplete?.(); }}>
      <DialogContent
        className="bg-card border-border w-full sm:max-w-2xl"
        showCloseButton={dismissible}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-center">
            {t("chooseRole")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          {/* Business Owner */}
          <button
            onClick={() => setSelected("BUSINESS_OWNER")}
            className={`
              relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-all
              ${selected === "BUSINESS_OWNER"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
              }
            `}
          >
            {selected === "BUSINESS_OWNER" && (
              <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-primary" />
            )}
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <p className="font-medium text-foreground">{t("businessOwnerTitle")}</p>
            <ul className="space-y-1.5 mt-1">
              <li className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&#x2022;</span>
                {t("businessOwnerFeature1")}
              </li>
              <li className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&#x2022;</span>
                {t("businessOwnerFeature2")}
              </li>
              <li className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&#x2022;</span>
                {t("businessOwnerFeature3")}
              </li>
            </ul>
          </button>

          {/* Lawyer */}
          <button
            onClick={() => setSelected("LAWYER")}
            className={`
              relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-all
              ${selected === "LAWYER"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
              }
            `}
          >
            {selected === "LAWYER" && (
              <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-primary" />
            )}
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <p className="font-medium text-foreground">{t("lawyerTitle")}</p>
            <ul className="space-y-1.5 mt-1">
              <li className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&#x2022;</span>
                {t("lawyerFeature1")}
              </li>
              <li className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&#x2022;</span>
                {t("lawyerFeature2")}
              </li>
              <li className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&#x2022;</span>
                {t("lawyerFeature3")}
              </li>
            </ul>
          </button>
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected || setRole.isPending}
          className="btn-brutal w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {setRole.isPending
            ? "..."
            : selected
              ? t("continueAs", { role: roleLabel })
              : t("chooseRole")
          }
        </button>
      </DialogContent>
    </Dialog>
  );
}
