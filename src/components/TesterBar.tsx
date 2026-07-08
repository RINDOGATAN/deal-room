"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RotateCcw, FlaskConical } from "lucide-react";
import { TESTER_EMAILS } from "@/lib/tester";

const TESTER_MODE_ON = process.env.NEXT_PUBLIC_TESTER_MODE === "true";

/**
 * Floating bar shown to tester-mode users with a one-click data reset.
 * Only renders when:
 *  - `NEXT_PUBLIC_TESTER_MODE=true` (client gate)
 *  - The current session email matches one of the tester emails
 */
export function TesterBar() {
  const { data: session } = useSession();
  const t = useTranslations("tester");
  const [resetting, setResetting] = useState(false);

  if (!TESTER_MODE_ON) return null;
  const email = session?.user?.email?.toLowerCase();
  if (!email || !(TESTER_EMAILS as readonly string[]).includes(email)) return null;

  const persona = email.startsWith("tester-startup")
    ? t("personaStartup")
    : email.startsWith("tester-lawyer")
      ? t("personaLawyer")
      : t("personaBusiness");

  const reset = async () => {
    if (!confirm(t("resetConfirm"))) return;
    setResetting(true);
    try {
      const res = await fetch("/api/tester/reset", { method: "POST" });
      if (!res.ok) {
        toast.error(t("resetFailed"));
        return;
      }
      toast.success(t("resetSuccess"));
      // Force a fresh read of /deals.
      window.location.href = "/deals";
    } catch {
      toast.error(t("resetFailed"));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-30 card-brutal border-primary/40 bg-card/95 backdrop-blur-sm flex items-center gap-3 py-2 px-3 shadow-lg">
      <FlaskConical className="w-4 h-4 text-primary flex-shrink-0" />
      <div className="text-xs">
        <p className="font-medium leading-tight">{t("modeLabel")}</p>
        <p className="text-muted-foreground leading-tight">{persona}</p>
      </div>
      <button
        onClick={reset}
        disabled={resetting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border hover:bg-secondary transition-colors disabled:opacity-50"
        title={t("resetTitle")}
        aria-label={t("resetTitle")}
      >
        <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">{resetting ? t("resetting") : t("reset")}</span>
      </button>
    </div>
  );
}
