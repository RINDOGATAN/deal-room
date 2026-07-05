"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { createLogger } from "@/lib/logger";

const logger = createLogger("billing");

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        logger.error("Portal error", { err: String(data.error) });
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-full hover:bg-secondary transition-colors"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4" />
      )}
      Manage Billing
    </button>
  );
}
