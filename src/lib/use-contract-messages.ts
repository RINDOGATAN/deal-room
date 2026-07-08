"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";

type Messages = Record<string, unknown>;

const cache: Record<string, Messages> = {};

/**
 * Load the message bundle for a deal's contract language on demand.
 * Avoids the previous pattern of `import enMessages from …; import
 * esMessages from …;` at module-top, which bundled BOTH locales
 * (~256KB raw / ~60KB gzipped) on every per-deal page even though
 * only one is ever rendered. Dynamic-imported chunks are emitted by
 * webpack as separate files, so each user downloads only their
 * contract's locale on first visit.
 *
 * Returns null while the import is in flight; the calling page is
 * expected to already show a loading skeleton during its tRPC fetch
 * (deal.getById etc.), so the message-load latency overlaps it
 * rather than causing a second perceptible wait.
 */
export function useContractMessages(contractLang: string | null | undefined): Messages | null {
  const normalized = contractLang === "es" ? "es" : "en";
  const [messages, setMessages] = useState<Messages | null>(() => cache[normalized] ?? null);

  useEffect(() => {
    if (cache[normalized]) {
      setMessages(cache[normalized]);
      return;
    }
    let cancelled = false;
    const loader =
      normalized === "es"
        ? import("@/messages/es.json")
        : import("@/messages/en.json");
    loader.then((m) => {
      const data = (m as { default: Messages }).default;
      cache[normalized] = data;
      if (!cancelled) setMessages(data);
    });
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  return messages;
}
