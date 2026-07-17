"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface EnableMultipleFeaturesModalProps {
  open: boolean;
  onClose: () => void;
  skills: { id: string; name: string }[];
  returnUrl?: string;
}

export function EnableMultipleFeaturesModal({
  open,
  onClose,
  skills,
  returnUrl,
}: EnableMultipleFeaturesModalProps) {
  const t = useTranslations("premium");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = skills.length * 9;
  const totalLabel = t("perMonth", { price: formatPrice(total) });

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillPackageIds: skills.map((s) => s.id),
          returnUrl,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || t("genericError"));
        setLoading(false);
      }
    } catch {
      setError(t("networkError"));
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("enableMultipleTitle", { count: skills.length })}</DialogTitle>
          <DialogDescription>
            {t("enableMultipleDescription")}
          </DialogDescription>
        </DialogHeader>
        <ul className="my-4 space-y-1 text-sm">
          {skills.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>{s.name}</span>
              <span className="text-muted-foreground">
                {t("perMonthShort", { price: formatPrice(9) })}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-3 text-sm font-medium flex items-center justify-between">
          <span>{t("monthlyTotal")}</span>
          <span>{totalLabel}</span>
        </div>
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
        )}
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-sm hover:bg-muted/50 rounded-full"
          >
            {tCommon("cancel")}
          </button>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="btn-brutal text-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("redirecting")}
              </span>
            ) : (
              t("subscribe", { price: totalLabel })
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
