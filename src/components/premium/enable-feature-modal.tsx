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

interface EnableFeatureModalProps {
  open: boolean;
  onClose: () => void;
  skillPackageId: string;
  skillName: string;
  /**
   * Skill price in minor units (cents). Optional — if omitted the
   * modal falls back to "€9/month" for backwards compatibility with
   * call sites that don't yet pass per-skill pricing through.
   */
  priceAmount?: number;
  /** ISO currency code, e.g. "eur" or "usd". Optional, see priceAmount. */
  priceCurrency?: string;
  returnUrl?: string;
}

function formatSkillPrice(amount?: number, currency?: string): string {
  // Legacy call sites: stay at €9 so behavior doesn't change.
  if (amount == null) return formatPrice(9);

  const major = amount / 100;
  const code = (currency ?? "eur").toLowerCase();
  const symbol = code === "usd" ? "$" : code === "gbp" ? "£" : "€";
  // Strip trailing .00 for whole amounts so "$9" not "$9.00".
  const display = Number.isInteger(major) ? major.toString() : major.toFixed(2);
  return `${symbol}${display}`;
}

export function EnableFeatureModal({
  open,
  onClose,
  skillPackageId,
  skillName,
  priceAmount,
  priceCurrency,
  returnUrl,
}: EnableFeatureModalProps) {
  const t = useTranslations("premium");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const priceLabel = t("perMonth", { price: formatSkillPrice(priceAmount, priceCurrency) });

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillPackageIds: [skillPackageId], returnUrl }),
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
          <DialogTitle>{t("enableTitle", { name: skillName })}</DialogTitle>
          <DialogDescription>
            {t("enableDescription", { price: priceLabel })}
          </DialogDescription>
        </DialogHeader>
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
              t("subscribe", { price: priceLabel })
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
