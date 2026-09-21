"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { features } from "@/config/features";
import { PILOT_RUN_URL } from "@/lib/pilot";

export const PILOT_BANNER_DISMISS_KEY = "dealroom.pilotBannerDismissed";

/**
 * One-line notice on every signed-in page of the hosted pilot (mounted in
 * the dashboard layout; public pages carry no banner), dismissible for the
 * browser session. Renders nothing on the kit. `hosted` exists for tests.
 */
export function PilotBanner({ hosted = features.hostedPilot }: { hosted?: boolean }) {
  const t = useTranslations("pilot");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!hosted) return;
    try {
      if (window.sessionStorage.getItem(PILOT_BANNER_DISMISS_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after hydration; reading it during render would mismatch the server markup
        setDismissed(true);
      }
    } catch {
      // Storage blocked: the banner simply stays.
    }
  }, [hosted]);

  if (!hosted || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(PILOT_BANNER_DISMISS_KEY, "1");
    } catch {
      // Storage blocked: dismissed for this page view only.
    }
  };

  return (
    <div
      role="note"
      data-testid="pilot-banner"
      className="w-full bg-primary/10 border-b border-primary/30 text-foreground"
    >
      <div className="max-w-7xl mx-auto flex items-start sm:items-center gap-3 px-4 py-2 text-xs sm:text-sm">
        <p className="flex-1">
          {t.rich("banner", {
            run: (chunks) => (
              <a
                href={PILOT_RUN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline decoration-primary/40 hover:decoration-primary"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          title={t("dismiss")}
          className="p-1 text-muted-foreground hover:text-foreground rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
