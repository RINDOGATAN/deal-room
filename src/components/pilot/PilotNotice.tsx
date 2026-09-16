"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { features } from "@/config/features";
import { trpc } from "@/lib/trpc";
import { PILOT_CAPS, PILOT_EXPORT_PATH, PILOT_RUN_URL, type PilotCapReason } from "@/lib/pilot";

const linkClass =
  "font-medium text-primary underline decoration-primary/40 hover:decoration-primary";

const runLink = (chunks: React.ReactNode) => (
  <a href={PILOT_RUN_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
    {chunks}
  </a>
);

const exportLink = (chunks: React.ReactNode) => (
  <a href={PILOT_EXPORT_PATH} className={linkClass}>
    {chunks}
  </a>
);

/** The banner sentence, fixed (not dismissible), for the sign-up screen. */
export function PilotSignupNotice() {
  const t = useTranslations("pilot");
  if (!features.hostedPilot) return null;
  return (
    <p data-testid="pilot-signup-notice" className="text-xs text-muted-foreground text-center">
      {t.rich("banner", { run: runLink })}
    </p>
  );
}

/** A reached cap, naming both ways out: your own instance, and the export. */
export function PilotCapMessage({ reason }: { reason: PilotCapReason }) {
  const t = useTranslations("pilot");
  const text =
    reason === "read_only"
      ? t.rich("readOnly", { days: PILOT_CAPS.editDays, run: runLink, export: exportLink })
      : reason === "deals"
        ? t.rich("capDeals", { limit: PILOT_CAPS.deals, run: runLink, export: exportLink })
        : t.rich("capJourneys", { limit: PILOT_CAPS.journeys, run: runLink, export: exportLink });
  return (
    <div
      role="status"
      data-testid="pilot-cap-message"
      className="card-brutal border-primary/40 bg-primary/5 flex items-start gap-3 py-3"
    >
      <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

/**
 * Shows the reached cap, if any, for a page that creates records. `kind`
 * is the ceiling that page adds to; read-only wins over a ceiling.
 * Renders nothing on the kit or while nothing is reached.
 */
export function PilotCapNotice({ kind }: { kind?: "deals" | "journeys" }) {
  const { data } = trpc.pilot.status.useQuery(undefined, {
    enabled: features.hostedPilot,
    staleTime: 30_000,
  });
  if (!features.hostedPilot || !data?.hosted) return null;
  if (data.readOnly) return <PilotCapMessage reason="read_only" />;
  if (kind && data[kind].used >= data[kind].limit) return <PilotCapMessage reason={kind} />;
  return null;
}
