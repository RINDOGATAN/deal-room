"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
}

export function EnableFeatureModal({
  open,
  onClose,
  skillPackageId,
  skillName,
}: EnableFeatureModalProps) {
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillPackageIds: [skillPackageId] }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enable {skillName}</DialogTitle>
          <DialogDescription>
            Add this feature to your account for €9/month. You can cancel
            anytime from the billing portal.
          </DialogDescription>
        </DialogHeader>
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
              "Subscribe — €9/month"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
