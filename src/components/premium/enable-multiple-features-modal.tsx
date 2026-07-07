"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = skills.length * 9;

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
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enable {skills.length} Features</DialogTitle>
          <DialogDescription>
            Add the following features to your account:
          </DialogDescription>
        </DialogHeader>
        <ul className="my-4 space-y-1 text-sm">
          {skills.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>{s.name}</span>
              <span className="text-muted-foreground">{formatPrice(9)}/mo</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-3 text-sm font-medium flex items-center justify-between">
          <span>Monthly total</span>
          <span>{formatPrice(total)}/month</span>
        </div>
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
        )}
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-sm hover:bg-muted/50 rounded-full"
          >
            Cancel
          </button>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="btn-brutal text-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting...
              </span>
            ) : (
              `Subscribe — ${formatPrice(total)}/month`
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
